# -*- coding: utf-8 -*-
"""
메리츠증권 ELS 스크래버
- DrissionPage를 통해 Eversafe Web을 우회하여 API 응답(JSON) 확인
- 관련 상품의 PDF(투자설명서/간이투자설명서)를 다운로드해 pdfplumber로 파싱 (KI/평가일 등 추출)
- 추출된 데이터를 Google Sheets용 앱스스크립트로 전송
- Chromium 기본 헤드리스. 창으로 보려면 PLAYWRIGHT_HEADLESS=0
"""

import os
import re
import sys
import tempfile
import time
from typing import Any, Optional

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    from DrissionPage import ChromiumPage, ChromiumOptions
except ModuleNotFoundError:
    sys.stderr.write("DrissionPage 패키지가 없습니다. (pip install DrissionPage)\n")
    sys.exit(1)

try:
    import pdfplumber
except ModuleNotFoundError:
    sys.stderr.write("pdfplumber 패키지가 없습니다. (pip install pdfplumber)\n")
    sys.exit(1)

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

log = setup_logging("meritz")

def parse_meritz_pdf(pdf_url: str) -> dict[str, str]:
    data = {}
    try:
        r = requests.get(
            pdf_url, verify=False,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            timeout=30,
        )
    except requests.RequestException as e:
        return {"_error": f"PDF 다운로드 실패: {e}"}
    if r.status_code != 200:
        return {"_error": f"PDF 다운로드 실패 ({r.status_code})"}

    full_text = []
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
            tmp.write(r.content)
            tmp.flush()
            with pdfplumber.open(tmp.name) as pdf:
                for page in pdf.pages[:15]:
                    text = page.extract_text()
                    if text:
                        full_text.append(text)
    except Exception as e:
        return {"_error": f"PDF 파싱 에러: {e}"}
        
    text = "\n".join(full_text)
    
    # 1. KI 추출
    m_ki = re.search(r"(?:낙인구간|하락한계가격)[\s\S]{0,10}?(\d{2,3}(?:\.\d+)?)\s*%", text)
    if m_ki:
        data["KI"] = f"{float(m_ki.group(1)):g}%"
    else:
        for m in re.finditer(r"(?:낙인|녹인|Knock-In|KI|최초기준가격의)[^\n]{0,40}?(\d{2,3}(?:\.\d+)?)\s*%(?:\s*미만)?", text):
            matched_str = m.group(0)
            # '예:' 또는 '배리어'가 들어간 안내사항 문구 무시
            if "예:" in matched_str or "예시" in matched_str or "배리어" in matched_str or "이상" in matched_str:
                continue
            if "미만" in matched_str or "하락" in matched_str or "낙인" in matched_str:
                data["KI"] = f"{float(m.group(1)):g}%"
                break
                
    if "KI" not in data:
        if re.search(r"(노낙인|No KI|No-KI)", text, re.IGNORECASE):
            data["KI"] = "없음"

    # 2. 조기상환평가일, 상환조건 추출
    # "1차 조기상환평가일 2026.06.24 95% 2차 2026.12.23 90%" 등의 패턴이나 줄단위
    num_map = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두"]
    for i in range(1, 13):
        # (?<!\d) 로 앞에 숫자가 없을 때만 매칭 (11차 검색 시 '1차' 오매칭 방지)
        m = re.search(rf"(?<!\d){i}차\s*(?:[^\n]*?평가일)?\s*(\d{{4}}[./년]\s*\d{{1,2}}[./월]\s*\d{{1,2}}[일]?)", text)
        if m:
            data[f"{i}차 평가일"] = normalize_date_str(m.group(1))

        rate_m = re.search(rf"(?<!\d){i}차(?:[^\n]*?(?:상환조건|지급조건|가격|상환율))?\s*(?:최초기준가격의\s*)?(\d{{2,3}}\.?\d*)\s*%", text)
        if rate_m:
            data[f"{i}차"] = f"{rate_m.group(1)}%"
        else:
            rate_m2 = re.search(rf"(?:{num_map[i-1]}번째|{i}번째)[\s\S]{{0,100}}?조기상환[\s\S]{{0,100}}?(\d{{2,3}}\.?\d*)\s*%\s*이상", text)
            if rate_m2:
                data[f"{i}차"] = f"{rate_m2.group(1)}%"
            else:
                rate_m3 = re.search(rf"(?<!\d){i}차\s*(?:[^\n]*?평가일)?\s*\d{{4}}[./년]\s*\d{{1,2}}[./월]\s*\d{{1,2}}[일]?\s*(?:~|~[\\d\\s./]+)?\s*.*?(\d{{2,3}}\.?\d*)\s*%", text)
                if rate_m3:
                    data[f"{i}차"] = f"{rate_m3.group(1)}%"

    # 3. 만기평가일 및 만기상환조건 추출 (마지막 차수로 추가)
    last_idx = max([int(k.replace("차", "")) for k in data.keys() if k.endswith("차") and k[:-1].isdigit()] + [0])
    if last_idx > 0 and last_idx < 12:
        next_idx = last_idx + 1
        m_maturity_date = re.search(r"만기평가일\s*(?:\n|:)\s*(\d{4}[./년]\s*\d{1,2}[./월]\s*\d{1,2}[일]?)", text)
        if not m_maturity_date:
            m_maturity_date = re.search(r"만기평가일\s*[\]\)>\-]\s*(\d{4}[./년]\s*\d{1,2}[./월]\s*\d{1,2}[일]?)", text)
            
        if m_maturity_date:
            data[f"{next_idx}차 평가일"] = normalize_date_str(m_maturity_date.group(1))
            
        m_maturity_rate = re.search(r"만기평가가격이[\s\S]{0,100}?최초기준가격의\s*(\d{2,3}(?:\.\d+)?)\s*%\s*이상", text)
        if m_maturity_rate:
            data[f"{next_idx}차"] = f"{float(m_maturity_rate.group(1)):g}%"

    # 4. 기준가(최초기준가격) 추출
    for idx, bp_m in enumerate(
        re.finditer(r"최초기준가격[^\n]*?([\d,]+(?:\.\d+)?)\s*(?:포인트|원|pt|p|\n)", text, re.IGNORECASE),
        start=1,
    ):
        if idx <= 3:
            data[f"기준가{idx}"] = bp_m.group(1).replace(",", "")

    return data

def scrape_meritz_els(page: ChromiumPage, product_round: str) -> dict[str, Any]:
    round_s = str(product_round).strip().replace("회", "")
    
    page.listen.start('SbscIssuIqryList.do')
    page.get('https://home.imeritz.com/drvtlnkdprod/SbscCmptProd.do')
    page.wait.load_start()
    time.sleep(5)
    
    # Wait for page to be ready
    if not page.wait.ele_displayed('#korIssuAbwrName', timeout=15):
        return {"_error": "검색 입력란이 표시되지 않음 (Eversafe 차단 또는 로딩 대기 초과)"}
        
    page.ele('#korIssuAbwrName').input(round_s)
    
    # 기존에 페이지 로딩 시 발생한 API 패킷 등을 무시하기 위해 리스너를 재설정합니다.
    page.listen.stop()
    page.listen.start('SbscIssuIqryList.do')
    
    page.ele('#searchBtn').click()
    
    # Wait for API packet
    packet = page.listen.wait(timeout=15)
    if not packet:
        return {"_error": f"회차 '{round_s}' 검색 API를 캡처하지 못했습니다."}
        
    try:
        data = packet.response.body
        rl = data.get("resultList", [])
        if not rl or not rl[0]:
            return {"_error": f"검색 결과가 없습니다. (회차 {round_s})"}
            
        items = rl[0] if isinstance(rl[0], list) else rl
        matched_item = None
        for item in items:
            name = str(item.get("KorIssuAbwrName", ""))
            if round_s in name:
                matched_item = item
                break
                
        if not matched_item:
            matched_item = items[0]
            
    except Exception as e:
        return {"_error": f"API JSON 분석 에러: {e}"}
        
    result = {}
    
    # 수익률
    prft = matched_item.get("ExptErt", "")
    if prft:
        try:
            val = float(prft)
            result["수익률"] = f"{val:g}%"
        except ValueError:
            result["수익률"] = prft
            
    # 티커1~3
    chan = matched_item.get("SaleChanExpl", "")
    tickers = [x.strip() for x in re.split(r"[,/]", chan) if x.strip()]
    for idx, t in enumerate(tickers[:3], start=1):
        result[f"티커{idx}"] = t
        result[f"현재가{idx}"] = current_price_formula(t)
        
    # 만기일 / 발행일 (fallback)
    pblc_date = matched_item.get("PblcDate", "")
    if pblc_date: result["발행일"] = normalize_date_str(pblc_date)
    
    # PDF 추출
    pdf_path = matched_item.get("AtchFilePathName", "")
    pdf_url = ""
    
    if pdf_path:
        if pdf_path.startswith("http"):
            pdf_url = pdf_path
        else:
            pdf_name = matched_item.get("AtchFileName", "")
            pdf_url = "https://home.imeritz.com" + pdf_path + pdf_name
            
    if pdf_url:
        print(f"  PDF URL 확인: {pdf_url}")
        pdf_data = parse_meritz_pdf(pdf_url)
        if pdf_data.get("_error"):
            print("  [PDF 경고]", pdf_data["_error"])
        else:
            result.update(pdf_data)
            
    return result

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

    targets = filter_scrape_targets(items, "메리츠증권")
    if not targets:
        log.info(
            "조건에 맞는 상품이 없습니다. "
            "(상태「청약 중(대기)」, 메리츠증권, 시트「발행일」≤오늘, 「수익률」비어 있음)"
        )
        return 0

    co = ChromiumOptions()
    co.auto_port()
    headless = (os.getenv("PLAYWRIGHT_HEADLESS", "1") or "1").strip().lower() not in (
        "0", "false", "no",
    )
    co.set_headless(headless)
    co.set_argument('--no-sandbox')

    from pathlib import Path
    try:
        chrome_path = list(Path(os.path.expanduser('~/.cache/ms-playwright/')).glob('chromium-*/chrome-linux64/chrome'))[0]
        co.set_browser_path(str(chrome_path))
    except IndexError:
        pass

    try:
        page = ChromiumPage(co)
    except Exception as e:
        log.error("브라우저 실행 실패: %s", e)
        return 1

    for row in targets:
        row_index = row.get("row_index")
        product_round = row.get("상품회차")
        if row_index is None or product_round is None:
            continue

        log.info("처리 중: row_index=%s, 상품회차=%s", row_index, product_round)
        try:
            scraped = scrape_meritz_els(page, str(product_round))
        except Exception as e:
            log.error("  스크래핑 예외: %s", e, exc_info=True)
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

    page.quit()
    return 0

if __name__ == "__main__":
    sys.exit(main())
