# -*- coding: utf-8 -*-
"""
키움증권 ELS 상세 스크래핑 후 Google Apps Script 웹앱으로 시트 업데이트.

설치:
  pip install requests python-dotenv beautifulsoup4

실행 (프로젝트 루트에서, .env에 VITE_WEB_APP_URL 설정):
  python server/els_kiwoom_scraper.py

브라우저(Playwright 등)를 쓰지 않고 requests·HTML 파싱만 사용하므로 별도 헤드리스 설정 없음.

대상 행 (GET ?api=els_pending = 상태「청약 중(대기)」만):
  - 증권사가 키움증권
  - 시트「발행일」이 오늘 또는 과거 (파싱 가능한 경우만)
  - 「수익률」이 아직 비어 있음 (이미 채워진 행은 건너뜀)
"""

from __future__ import annotations

import re
import sys
import time
from typing import Any, Optional

import requests

try:
    from bs4 import BeautifulSoup
except ModuleNotFoundError:
    sys.stderr.write("beautifulsoup4 패키지가 없습니다. pip install beautifulsoup4 를 실행하세요.\n")
    raise SystemExit(1) from None

from els_common import (
    build_update_body,
    current_price_formula,
    fetch_els_items,
    filter_scrape_targets,
    load_env,
    normalize_date_str,
    post_update,
    setup_logging,
)

log = setup_logging("kiwoom")

_KIWOOM_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)


def _safe_strike_value(raw: str) -> str:
    """행사가격 셀 텍스트에서 숫자(%)만 추출. 숫자 없으면 빈 문자열."""
    cleaned = re.sub(r"[^\d.]", "", raw)
    if not cleaned or cleaned == ".":
        return ""
    return cleaned + "%"


def scrape_kiwoom_els_detail(product_round: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    round_s = str(product_round).strip().replace("회", "").replace("호", "")

    session = requests.Session()
    session.headers.update({
        "User-Agent": _KIWOOM_UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.kiwoom.com/wm/edl/es010/edlElsView",
    })

    search_url = "https://www1.kiwoom.com/wm/edl/es020/getEndElsMainJson"
    payload = {
        "contGubn": "", "nextData": "", "ordTp": "7", "sortTp": "D",
        "elsTp": "", "prncaPayTp": "", "rpyYn": "",
        "searchStartDt": "2010.01.01", "searchEndDt": "2035.12.31",
        "salFundNm": round_s,
    }

    try:
        resp = session.post(search_url, data=payload, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        body_snippet = ""
        try:
            body_snippet = e.response.text[:500] if e.response is not None else ""
        except Exception:
            pass
        data["_error"] = f"검색 API 요청 실패: {e}"
        if body_snippet:
            data["_error"] += f" | 응답 본문: {body_snippet}"
        return data

    try:
        api_data = resp.json()
    except ValueError:
        data["_error"] = "검색 API 응답이 JSON이 아닙니다 (로그인 리다이렉트 등 확인 필요)."
        return data

    items = api_data.get("result", {}).get("resultMap", {}).get("g1", [])

    matched_item = None
    for item in items:
        nm = str(item.get("stk_nm", ""))
        if f"{round_s}회" in nm or f"{round_s}호" in nm or round_s in nm:
            matched_item = item
            break

    if not matched_item:
        data["_error"] = f"키움증권 검색 API에서 회차 '{round_s}' 상품을 찾지 못했습니다."
        return data

    stk_code = matched_item.get("stk_code")
    crnc_code = matched_item.get("crnc_code")

    # 수익률: '연 X%' 또는 '세전 X%' 또는 숫자만 있는 경우
    prft_str = matched_item.get("expc_errt_infr", "") or matched_item.get("prft_cntn", "")
    m_prft = re.search(r"(?:연|세전)\s*([\d.]+)\s*%", prft_str)
    if not m_prft:
        m_prft = re.search(r"([\d.]+)\s*%", prft_str)
    if m_prft:
        data["수익률"] = f"{m_prft.group(1)}%"

    # KI
    type_cntn = matched_item.get("type_cntn", "")
    ki_yn = matched_item.get("ki_yn", "N")

    m_ki = re.search(r"(?:KI|녹인|낙인|배리어)\s*(\d{2,3})", type_cntn, re.IGNORECASE)
    if not m_ki:
        m_ki = re.search(r"(\d{2,3})\s*(?:KI|녹인|낙인)", type_cntn, re.IGNORECASE)
    if m_ki:
        data["KI"] = f"{m_ki.group(1)}%"
    elif ki_yn == "Y":
        data["KI"] = "있음"

    # 티커
    base_aset_str = matched_item.get("base_aset", "")
    tickers = [x.strip() for x in re.split(r"[,/]", base_aset_str) if x.strip()]
    for idx, t in enumerate(tickers[:3], start=1):
        data[f"티커{idx}"] = t
        data[f"현재가{idx}"] = current_price_formula(t)

    # 상세 HTML
    detail_url = "https://www1.kiwoom.com/wm/edl/es010/fndElsDetailPopup"
    try:
        detail_resp = session.post(
            detail_url,
            data={"salFundCd": stk_code, "tabNo": "1", "crncCode": crnc_code},
            timeout=20,
        )
        detail_resp.raise_for_status()
    except requests.RequestException as e:
        data["_error"] = f"상세 페이지 요청 실패: {e}"
        return data

    if "html" not in detail_resp.headers.get("Content-Type", "").lower():
        data["_error"] = "상세 페이지 응답이 HTML이 아닙니다."
        return data

    soup = BeautifulSoup(detail_resp.text, "html.parser")

    # 녹인 가격 추출
    if ki_yn == "Y":
        for th in soup.find_all(["th", "span", "div"]):
            txt = th.get_text()
            if "녹인" in txt or "하락한계가격" in txt:
                nxt = th.find_next_sibling(["td", "dd"])
                if nxt:
                    ki_val = _safe_strike_value(nxt.get_text(strip=True))
                    if ki_val:
                        data["KI"] = ki_val
                    break

    # 평가일/행사가 추출
    for table in soup.find_all("table"):
        headers_text = [t.get_text(strip=True).replace(" ", "") for t in table.find_all("th")]
        headers_joined = "".join(headers_text)

        if "조기상환평가일" in headers_joined or "만기상환평가일" in headers_joined or "평가일" in headers_joined:
            rows = table.find_all("tr")
            for row in rows:
                cols = row.find_all(["td", "th"])
                if len(cols) < 3:
                    continue
                c0 = cols[0].get_text(strip=True).replace("차", "")

                if c0.isdigit():
                    round_num = int(c0)
                    date_str = cols[1].get_text(strip=True)
                else:
                    date_str = c0

                m_date = re.search(r"\d{4}[./]\d{2}[./]\d{2}", date_str)
                if not m_date:
                    continue

                if not c0.isdigit():
                    existing_rounds = [
                        int(k.replace("차 평가일", ""))
                        for k in data if "차 평가일" in k
                    ]
                    round_num = max(existing_rounds) + 1 if existing_rounds else 1

                if f"{round_num}차 평가일" in data:
                    continue

                data[f"{round_num}차 평가일"] = normalize_date_str(m_date.group(0))

                strike_val = ""
                if len(cols) >= 5 and "상환조건" in headers_joined:
                    if not c0.isdigit() and "만기상환평가일" in headers_joined:
                        strike_val = cols[3].get_text(strip=True) if len(cols) >= 4 else cols[-1].get_text(strip=True)
                    else:
                        strike_val = cols[4].get_text(strip=True)
                elif len(cols) == 3:
                    strike_val = cols[2].get_text(strip=True)
                else:
                    strike_val = cols[-1].get_text(strip=True)

                data[f"{round_num}차"] = _safe_strike_value(strike_val)

        # 최초기준가격 테이블
        if "최초기준가격" in headers_joined:
            rows = table.find_all("tr")
            base_prices = []
            for row in rows:
                cols = row.find_all("td")
                if len(cols) >= 2:
                    val = cols[1].get_text(strip=True).replace(",", "")
                    if re.match(r"^[\d.]+$", val):
                        base_prices.append(val)
            for idx, bp in enumerate(base_prices[:3], start=1):
                data[f"기준가{idx}"] = bp

    return data

def main() -> int:
    try:
        api_base = load_env()
    except SystemExit as e:
        log.error(str(e))
        return 1

    try:
        items = fetch_els_items(api_base, logger=log)
    except Exception as e:
        log.error("목록 조회 실패: %s", e)
        return 1

    targets = filter_scrape_targets(items, "키움증권")
    if not targets:
        log.info("조건에 맞는 상품이 없습니다. (상태「청약 중(대기)」, 키움증권, 시트「발행일」≤오늘, 「수익률」비어 있음)")
        return 0

    for i, row in enumerate(targets):
        row_index = row.get("row_index")
        product_round = row.get("상품회차")
        if row_index is None or product_round is None:
            continue

        if i > 0:
            time.sleep(1.5)

        log.info("처리 중: row_index=%s, 상품회차=%s", row_index, product_round)
        try:
            scraped = scrape_kiwoom_els_detail(str(product_round))
        except Exception as e:
            log.error("  스크래핑 예외: %s", e)
            continue

        if scraped.get("_error"):
            log.error("  페이지 오류: %s", scraped.get("_error"))
            continue

        update_body = build_update_body(scraped)
        if not update_body:
            log.info("  추출된 필드 없음 — POST 생략")
            continue

        try:
            post_update(api_base, int(row_index), update_body, logger=log)
            log.info("  시트 업데이트 완료")
        except Exception as e:
            log.error("  POST 실패: %s", e)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
