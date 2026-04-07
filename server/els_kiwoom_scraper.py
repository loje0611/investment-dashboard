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

import json
import os
import re
import time
import sys
from datetime import date, datetime
from typing import Any, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    sys.stderr.write("python-dotenv 패키지가 없습니다.\n")
    raise SystemExit(1) from None

import requests
try:
    from bs4 import BeautifulSoup
except ModuleNotFoundError:
    sys.stderr.write("beautifulsoup4 패키지가 없습니다. pip install beautifulsoup4 를 실행하세요.\n")
    raise SystemExit(1) from None

SHEET_COLUMNS_SCRAPER_FILLS_ORDER = (
    "수익률", "KI",
    "1차", "2차", "3차", "4차", "5차", "6차",
    "7차", "8차", "9차", "10차", "11차", "12차",
    "티커1", "티커2", "티커3",
    "기준가1", "기준가2", "기준가3",
    "현재가1", "현재가2", "현재가3",
    "1차 평가일", "2차 평가일", "3차 평가일",
    "4차 평가일", "5차 평가일", "6차 평가일",
    "7차 평가일", "8차 평가일", "9차 평가일",
    "10차 평가일", "11차 평가일", "12차 평가일",
)

def _append_query(url: str, **params: str) -> str:
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q.update({k: v for k, v in params.items() if v is not None})
    new_query = urlencode(q) if q else ""
    return urlunparse((parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment))

def _is_empty_profit_rate(value: Any) -> bool:
    if value is None: return True
    if isinstance(value, str) and value.strip() == "": return True
    return False

def parse_korean_date(text: str) -> Optional[date]:
    if not text: return None
    s = re.sub(r"\s+", "", str(text).strip())
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y.%m.%d."):
        try:
            return datetime.strptime(s.replace("..", "."), fmt).date()
        except ValueError:
            continue
    m = re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})", text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None

def parse_sheet_issue_date(value: Any) -> Optional[date]:
    if value is None: return None
    s = str(value).strip()
    if not s: return None
    return parse_korean_date(s)

def fetch_els_items(api_base: str, timeout: float = 60.0) -> list[dict[str, Any]]:
    url = _append_query(api_base, api="els_pending")
    r = requests.get(url, timeout=timeout, headers={"Accept": "application/json"})
    r.raise_for_status()
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(f"API 오류: {data.get('error', '알 수 없는 오류')}")
    return data.get("items", [])

def filter_scrape_targets(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    API가 내려준 청약 대기 행 중, 수익률 비어 있음 + 키움증권 + 발행일≤오늘(파싱 가능한 행만).
    """
    today = date.today()
    out = []
    for row in items:
        if not _is_empty_profit_rate(row.get("수익률")): continue
        if str(row.get("증권사", "")).strip() != "키움증권": continue
        issue_d = parse_sheet_issue_date(row.get("발행일"))
        if issue_d is None or issue_d > today: continue
        out.append(row)
    return out

def _normalize_sheet_date(d: str) -> str:
    m = re.match(r"(\d{4})[./](\d{1,2})[./](\d{1,2})", str(d).strip())
    if m: return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return str(d).strip()

def _current_price_formula(ticker: str) -> str:
    t = (ticker or "").strip()
    if not t: return ""
    if "S&P" in t.upper() or "SNP" in t.upper(): return "=SNP500현재가"
    if "유로스탁스" in t or "EURO" in t.upper(): return "=EUROSTOXX50현재가"
    if "니케이" in t or "NIKKEI" in t.upper(): return "=NIKKEI225현재가"
    return f"={t}현재가"

def scrape_kiwoom_els_detail(product_round: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    round_s = str(product_round).strip().replace("회", "").replace("호", "")
    
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
    }
    
    # 1. Search for the precise product in Kiwoom List API
    search_url = "https://www1.kiwoom.com/wm/edl/es020/getEndElsMainJson"
    payload = {
        "contGubn": "", "nextData": "", "ordTp": "7", "sortTp": "D",
        "elsTp": "", "prncaPayTp": "", "rpyYn": "",
        "searchStartDt": "2010.01.01", "searchEndDt": "2030.12.31",
        "salFundNm": round_s
    }
    
    resp = requests.post(search_url, data=payload, headers=headers, timeout=15)
    resp.raise_for_status()
    api_data = resp.json()
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
    
    # Extract some basic info from JSON
    # 수익률
    prft_str = matched_item.get("expc_errt_infr", "") or matched_item.get("prft_cntn", "")
    m_prft = re.search(r"연\s*([\d.]+)\s*%", prft_str)
    if m_prft: data["수익률"] = f"{m_prft.group(1)}%"
    
    # KI 추출
    type_cntn = matched_item.get("type_cntn", "")
    ki_yn = matched_item.get("ki_yn", "N")
    
    m_ki = re.search(r"(?:KI|K|녹인|낙인|배리어)\s*(\d{2,3})", type_cntn, re.IGNORECASE)
    if not m_ki:
        m_ki = re.search(r"(\d{2,3})\s*(?:KI|K|녹인|낙인)", type_cntn, re.IGNORECASE)
    if m_ki:
        data["KI"] = f"{m_ki.group(1)}%"
    elif ki_yn == "Y":
        data["KI"] = "있음"

    # 티커 (기초자산)
    base_aset_str = matched_item.get("base_aset", "")
    tickers = [x.strip() for x in re.split(r"[,/]", base_aset_str) if x.strip()]
    for idx, t in enumerate(tickers[:3], start=1):
        data[f"티커{idx}"] = t
        data[f"현재가{idx}"] = _current_price_formula(t)
        
    # 녹인여부 체크
    ki_yn = matched_item.get("ki_yn", "N")
    
    # 2. Open Detail HTML
    detail_url = "https://www1.kiwoom.com/wm/edl/es010/fndElsDetailPopup"
    detail_resp = requests.post(detail_url, data={"salFundCd": stk_code, "tabNo": "1", "crncCode": crnc_code}, headers=headers, timeout=15)
    detail_resp.raise_for_status()
    
    soup = BeautifulSoup(detail_resp.text, "html.parser")
    
    # 녹인 가격 추출
    if ki_yn == "Y":
        for th in soup.find_all(["th", "span", "div"]):
            if "녹인" in th.get_text() or "하락한계가격" in th.get_text():
                nxt = th.find_next_sibling(["td", "dd"])
                if nxt:
                    data["KI"] = re.sub(r"[^\d.]", "", nxt.get_text(strip=True)) + "%"
                    break
                    
    # 평가일/행사가 추출 (조기상환평가일 & 만기상환평가일 테이블)
    for table in soup.find_all("table"):
        headers_text = [t.get_text(strip=True).replace(" ", "") for t in table.find_all("th")]
        headers_joined = "".join(headers_text)
        
        # 조기상환평가일, 행사가격이 있는 테이블 (만기평가일 테이블도 포함 가능)
        if "조기상환평가일" in headers_joined or "만기상환평가일" in headers_joined or "평가일" in headers_joined:
            rows = table.find_all("tr")
            for row in rows:
                cols = row.find_all(["td", "th"])
                if len(cols) >= 3:
                    c0 = cols[0].get_text(strip=True).replace("차", "")
                    
                    if c0.isdigit():
                        round_num = int(c0)
                        date_str = cols[1].get_text(strip=True)
                    else:
                        # 만기상환평가일 테이블인 경우 c0에 차수 대신 날짜가 들어오는 경우가 있음
                        date_str = c0
                        
                    m_date = re.search(r"\d{4}[./]\d{2}[./]\d{2}", date_str)
                    if m_date:
                        if not c0.isdigit():
                            existing_rounds = [int(k.replace("차 평가일", "")) for k in data.keys() if "차 평가일" in k]
                            round_num = max(existing_rounds) + 1 if existing_rounds else 1

                        # 이미 이 회차가 들어갔으면 중복 (예: 행이 여러 개인 경우)
                        if f"{round_num}차 평가일" not in data:
                            data[f"{round_num}차 평가일"] = _normalize_sheet_date(m_date.group(0))
                            
                            strike_val = ""
                            if len(cols) >= 5 and "상환조건" in headers_joined:
                                # 만기상환평가일은 c0:날짜 c1:지급일 c2:수익률 c3:상환조건 c4:평가가격
                                if not c0.isdigit() and "만기상환평가일" in headers_joined:
                                    strike_val = cols[3].get_text(strip=True) if len(cols) >= 4 else cols[-1].get_text(strip=True)
                                else:
                                    strike_val = cols[4].get_text(strip=True)
                            elif len(cols) == 3:
                                strike_val = cols[2].get_text(strip=True)
                            else:
                                strike_val = cols[-1].get_text(strip=True)
                                
                            data[f"{round_num}차"] = re.sub(r"[^\d.]", "", strike_val) + "%" if re.search(r"\d", strike_val) else ""


                        
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
            # 매칭
            for idx, bp in enumerate(base_prices[:3], start=1):
                data[f"기준가{idx}"] = bp

    return data

def post_update(api_base: str, row_index: int, payload: dict[str, Any], timeout: float = 60.0) -> None:
    body = {"action": "update", "row_index": row_index, **payload}
    raw = json.dumps(body, ensure_ascii=False)
    r = requests.post(
        api_base,
        data=raw.encode("utf-8"),
        timeout=timeout,
        headers={"Content-Type": "text/plain;charset=utf-8", "Accept": "application/json"},
    )
    r.raise_for_status()
    resp = r.json()
    if isinstance(resp, dict) and not resp.get("success"):
        raise RuntimeError(resp.get("error", "업데이트 실패"))

def main() -> int:
    load_dotenv()
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_path = os.path.join(root, ".env")
    if os.path.isfile(env_path):
        load_dotenv(env_path)

    api_base = (os.getenv("VITE_WEB_APP_URL") or "").strip()
    if not api_base:
        print("VITE_WEB_APP_URL이 .env에 없습니다.", file=sys.stderr)
        return 1

    try:
        items = fetch_els_items(api_base)
    except Exception as e:
        print(f"목록 조회 실패: {e}", file=sys.stderr)
        return 1

    targets = filter_scrape_targets(items)
    if not targets:
        print("조건에 맞는 상품이 없습니다. (상태「청약 중(대기)」, 키움증권, 시트「발행일」≤오늘, 「수익률」비어 있음)")
        return 0

    for row in targets:
        row_index = row.get("row_index")
        product_round = row.get("상품회차")
        if row_index is None or product_round is None:
            continue

        print(f"처리 중: row_index={row_index}, 상품회차={product_round}")
        try:
            scraped = scrape_kiwoom_els_detail(str(product_round))
        except Exception as e:
            print(f"  스크래핑 예외: {e}")
            continue

        if scraped.get("_error"):
            print(f"  페이지 오류: {scraped.get('_error')}")
            continue

        update_body = {
            k: scraped[k]
            for k in SHEET_COLUMNS_SCRAPER_FILLS_ORDER
            if k in scraped and scraped[k] is not None and str(scraped[k]).strip()
        }
        if not update_body:
            print("  추출된 필드 없음 — POST 생략")
            continue

        try:
            post_update(api_base, int(row_index), update_body)
            print("  시트 업데이트 완료")
        except Exception as e:
            print(f"  POST 실패: {e}", file=sys.stderr)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
