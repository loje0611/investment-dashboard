# -*- coding: utf-8 -*-
"""
메리츠증권 ELS 스크래버
- DrissionPage를 통해 Eversafe Web을 우회하여 API 응답(JSON) 확인
- 관련 상품의 PDF(투자설명서/간이투자설명서)를 다운로드해 pdfplumber로 파싱 (KI/평가일 등 추출)
- 추출된 데이터를 Google Sheets용 앱스스크립트로 전송
- Chromium 기본 헤드리스. 창으로 보려면 PLAYWRIGHT_HEADLESS=0
"""

import json
import os
import re
import sys
import time
from datetime import date, datetime
from typing import Any, Optional
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
import traceback

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    sys.stderr.write("python-dotenv 패키지가 없습니다.\n")
    sys.exit(1)

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

def parse_sheet_issue_date(value: Any) -> Optional[date]:
    if value is None: return None
    s = str(value).strip()
    if not s: return None
    for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    m = re.search(r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass
    return None

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
    API가 내려준 청약 대기 행 중, 수익률 비어 있음 + 메리츠증권 + 발행일≤오늘(파싱 가능한 행만).
    """
    today = date.today()
    out = []
    for row in items:
        if not _is_empty_profit_rate(row.get("수익률")): continue
        if str(row.get("증권사", "")).strip() != "메리츠증권": continue
        issue_d = parse_sheet_issue_date(row.get("발행일"))
        if issue_d is None or issue_d > today: continue
        out.append(row)
    return out

def _normalize_date_str(d: str) -> str:
    m = re.search(r"(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})", str(d).strip())
    if m: return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    
    m2 = re.search(r"(\d{4})(\d{2})(\d{2})", str(d).strip())
    if m2: return f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}"
    return str(d).strip()

def _current_price_formula(ticker: str) -> str:
    t = (ticker or "").strip()
    if not t: return ""
    if "S&P" in t.upper() or "SNP" in t.upper(): return "=SNP500현재가"
    if "유로스탁스" in t or "EURO" in t.upper() or "EUROSTOXX" in t.upper(): return "=EUROSTOXX50현재가"
    if "니케이" in t or "NIKKEI" in t.upper(): return "=NIKKEI225현재가"
    if "KOSPI" in t.upper() or "코스피" in t: return "=KOSPI200현재가"
    if "HSCEI" in t.upper() or "홍콩" in t: return "=HSCEI현재가"
    return f"={t}현재가"

def parse_meritz_pdf(pdf_url: str) -> dict[str, str]:
    data = {}
    r = requests.get(pdf_url, verify=False, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    if r.status_code != 200:
        return {"_error": f"PDF 다운로드 실패 ({r.status_code})"}
        
    pdf_path = "/tmp/meritz_temp.pdf"
    with open(pdf_path, "wb") as f:
        f.write(r.content)
        
    full_text = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
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
        m = re.search(rf"{i}차\s*(?:[^\n]*?평가일)?\s*(\d{{4}}[./년]\s*\d{{1,2}}[./월]\s*\d{{1,2}}[일]?)", text)
        if m:
            data[f"{i}차 평가일"] = _normalize_date_str(m.group(1))
            
        rate_m = re.search(rf"{i}차(?:[^\n]*?(?:상환조건|지급조건|가격|상환율))?\s*(?:최초기준가격의\s*)?(\d{{2,3}}\.?\d*)\s*%", text)
        if rate_m:
            data[f"{i}차"] = f"{rate_m.group(1)}%"
        else:
            # "첫번째 자동조기상환평가가격이 ... \n 85.00% 이상인 경우" 패턴 (멀티라인 대비)
            rate_m2 = re.search(rf"(?:{num_map[i-1]}번째|{i}번째)[\s\S]{{0,100}}?조기상환[\s\S]{{0,100}}?(\d{{2,3}}\.?\d*)\s*%\s*이상", text)
            if rate_m2:
                data[f"{i}차"] = f"{rate_m2.group(1)}%"
            else:
                # 테이블 구조인 경우: 1차 2026.06.24 85%
                rate_m3 = re.search(rf"{i}차\s*(?:[^\n]*?평가일)?\s*\d{{4}}[./년]\s*\d{{1,2}}[./월]\s*\d{{1,2}}[일]?\s*(?:~|~[\\d\\s./]+)?\s*.*?(\d{{2,3}}\.?\d*)\s*%", text)
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
            data[f"{next_idx}차 평가일"] = _normalize_date_str(m_maturity_date.group(1))
            
        m_maturity_rate = re.search(r"만기평가가격이[\s\S]{0,100}?최초기준가격의\s*(\d{2,3}(?:\.\d+)?)\s*%\s*이상", text)
        if m_maturity_rate:
            data[f"{next_idx}차"] = f"{float(m_maturity_rate.group(1)):g}%"

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
        result[f"현재가{idx}"] = _current_price_formula(t)
        
    # 만기일 / 발행일 (fallback)
    pblc_date = matched_item.get("PblcDate", "")
    if pblc_date: result["발행일"] = _normalize_date_str(pblc_date)
    
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
        print("VITE_WEB_APP_URL이 없습니다.")
        return 1

    try:
        items = fetch_els_items(api_base)
    except Exception as e:
        print(f"목록 조회 실패: {e}")
        return 1

    targets = filter_scrape_targets(items)
    if not targets:
        print(
            "조건에 맞는 상품이 없습니다. "
            "(상태「청약 중(대기)」, 메리츠증권, 시트「발행일」≤오늘, 「수익률」비어 있음)"
        )
        return 0

    co = ChromiumOptions()
    co.auto_port()
    headless = (os.getenv("PLAYWRIGHT_HEADLESS", "1") or "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    co.set_headless(headless)
    co.set_argument('--no-sandbox')
    
    # Playwright의 크로미움 바이너리를 사용 (버전에 따라 다를 수 있으므로 검색)
    from pathlib import Path
    try:
        chrome_path = list(Path(os.path.expanduser('~/.cache/ms-playwright/')).glob('chromium-*/chrome-linux64/chrome'))[0]
        co.set_browser_path(str(chrome_path))
    except IndexError:
        pass # 시스템 기본 chrome 사용 시도

    try:
        page = ChromiumPage(co)
    except Exception as e:
        print(f"브라우저 실행 실패: {e}")
        return 1

    for row in targets:
        row_index = row.get("row_index")
        product_round = row.get("상품회차")
        if row_index is None or product_round is None:
            continue

        print(f"처리 중: row_index={row_index}, 상품회차={product_round}")
        try:
            scraped = scrape_meritz_els(page, str(product_round))
        except Exception as e:
            traceback.print_exc()
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
            print(f"  POST 실패: {e}")

    page.quit()
    return 0

if __name__ == "__main__":
    sys.exit(main())
