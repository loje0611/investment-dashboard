# -*- coding: utf-8 -*-
"""
삼성증권 ELS 상세 스크래핑 후 Google Apps Script 웹앱으로 시트 업데이트.

설치:
  pip install requests playwright python-dotenv
  playwright install chromium

실행 (프로젝트 루트에서, .env에 VITE_WEB_APP_URL 설정):
  python server/els_samsung_scraper.py

대상 행 (GET ?api=els_pending = 상태「청약 중(대기)」만):
  - 증권사가 삼성증권
  - 시트「발행일」이 오늘 또는 과거 (파싱 가능한 경우만)
  - 「수익률」이 아직 비어 있음 (이미 채워진 행은 건너뜀)

삼성증권 상세 진입:
  기본은 ELS/DLS 찾기(search.do)에서「청약완료상품」탭으로 전환한 뒤,
  상단 검색에서 드롭다운「회차명」·입력란에 회차 입력·「검색」클릭으로 결과를 받고,
  그 결과의 상품명(previewPage)에서 ISCD를 읽어 completeDetailTab1.do 로 진입한다.
  SAMSUNG_ELS_DETAIL_URL_TEMPLATE 이 있으면 {round} 치환 URL을 그보다 우선한다.

시트 반영:
  - A~F열(증권사·상품회차·가입금액·상태·가입일·발행일)은 스크립트가 건드리지 않는다.
  - G열부터 `SHEET_COLUMNS_SCRAPER_FILLS_ORDER` 와 동일한 헤더명·순서로만 POST.
  - 상세 본문은 메인이 아니라 iframe `saleGoodsFileLoad.pop`(상품정보 탭) AJAX `#tab1FileLoadPage1_1` 에 로드됨 → 수익률·KI·차수 등은 해당 텍스트를 파싱.
  - 티커1~3는 iframe이 아니라 상세 화면 최상단 요약 영역의「기초자산」항목(dd/표 셀)에서만 읽는다. 실패 시에만 탭1 본문 파싱으로 보조.
  - 수익률은 웹의「세전 연 X%」에서 `X%` 만 저장.
  - 현재가1~3는 스크래핑 숫자 대신 `=티커명현재가` 수식(예: =KOSPI200현재가). 티커 S&P500 만 `=SNP500현재가`. 티커명은 티커1~3 셀 값과 동일(수식 접두만 예외).
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
    sys.stderr.write(
        "python-dotenv 패키지가 없습니다. 설치 후 다시 실행하세요.\n"
        "  pip3 install python-dotenv\n"
        "  또는 프로젝트 루트에서: pip3 install -r server/requirements.txt\n"
    )
    raise SystemExit(1) from None

import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# ELS목록 시트 1행: A~F는 수동/대시보드, G열부터 아래 순서와 헤더를 시트와 동일하게 둔다.
SHEET_COLUMNS_SCRAPER_FILLS_ORDER = (
    "수익률",
    "KI",
    "1차",
    "2차",
    "3차",
    "4차",
    "5차",
    "6차",
    "7차",
    "8차",
    "9차",
    "10차",
    "11차",
    "12차",
    "티커1",
    "티커2",
    "티커3",
    "기준가1",
    "기준가2",
    "기준가3",
    "현재가1",
    "현재가2",
    "현재가3",
    "1차 평가일",
    "2차 평가일",
    "3차 평가일",
    "4차 평가일",
    "5차 평가일",
    "6차 평가일",
    "7차 평가일",
    "8차 평가일",
    "9차 평가일",
    "10차 평가일",
    "11차 평가일",
    "12차 평가일",
)


def _append_query(url: str, **params: str) -> str:
    """기존 쿼리를 유지한 채 파라미터 병합."""
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q.update({k: v for k, v in params.items() if v is not None})
    new_query = urlencode(q) if q else ""
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment)
    )


def _is_empty_profit_rate(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def fetch_els_items(api_base: str, timeout: float = 60.0) -> list[dict[str, Any]]:
    """GET: 대기(청약 중) ELS 목록."""
    url = _append_query(api_base, api="els_pending")
    r = requests.get(
        url,
        timeout=timeout,
        headers={"Accept": "application/json"},
    )
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        raise ValueError("API 응답이 객체가 아닙니다.")
    if not data.get("success"):
        err = data.get("error", "알 수 없는 오류")
        raise RuntimeError(f"API 오류: {err}")
    items = data.get("items")
    if not isinstance(items, list):
        raise ValueError("응답에 items 배열이 없습니다.")
    return items


def parse_sheet_issue_date(value: Any) -> Optional[date]:
    """시트/API에서 내려온 발행일 값 → date. (YYYY-MM-DD, 한글 날짜 등)"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return None
    s = str(value).strip()
    if not s:
        return None
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            pass
    return parse_korean_date(s)


def filter_scrape_targets(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    수익률 비어 있음 + 삼성증권 + 발행일이 오늘 이전 또는 오늘인 행만.
    발행일이 비어 있거나 파싱 불가면 제외.
    """
    today = date.today()
    out: list[dict[str, Any]] = []
    for row in items:
        if not _is_empty_profit_rate(row.get("수익률")):
            continue
        broker = str(row.get("증권사", "")).strip()
        if broker != "삼성증권":
            continue
        issue_d = parse_sheet_issue_date(row.get("발행일"))
        if issue_d is None:
            continue
        if issue_d > today:
            continue
        out.append(row)
    return out


def parse_korean_date(text: str) -> Optional[date]:
    """'2026-03-28', '2026.03.28', '2026/03/28' 등 시도."""
    if not text:
        return None
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
            return None
    return None


def _safe_text(locator) -> Optional[str]:
    try:
        if locator.count() == 0:
            return None
        t = locator.first.inner_text(timeout=5000)
        return t.strip() if t else None
    except Exception:
        return None


def _extract_labeled_value(page, label_variants: tuple[str, ...]) -> Optional[str]:
    """라벨 텍스트 근처 셀/형제에서 값 추출 (구조가 다를 수 있어 여러 패턴 시도)."""
    for label in label_variants:
        try:
            row = page.locator(
                f"xpath=//*[contains(normalize-space(.), '{label}')]/ancestor::tr[1]"
            )
            if row.count():
                cells = row.first.locator("td, th")
                n = cells.count()
                if n >= 2:
                    return _safe_text(cells.nth(1))
            # dl dt/dd
            dt = page.locator(
                f"xpath=//dt[contains(normalize-space(.), '{label}')]/following-sibling::dd[1]"
            )
            if dt.count():
                return _safe_text(dt)
            # 인접 형제
            el = page.locator(
                f"xpath=//*[self::span or self::div or self::th or self::td]"
                f"[contains(normalize-space(.), '{label}')]/following-sibling::*[1]"
            )
            if el.count():
                return _safe_text(el)
        except Exception:
            continue
    return None


# 삼성증권 ELS/DLS 찾기 — 상품회차로 검색 후 상세(ingDetailTab1.do?ISCD=...) 진입
DEFAULT_SAMSUNG_ELS_SEARCH_URL = (
    "https://www.samsungpop.com/ux/kor/finance/els/saleGoods/search.do?MENU_ID="
)
SAMSUNG_DETAIL_PATH_SNIPPET = "ingDetailTab1.do"
SAMSUNG_COMPLETE_DETAIL_SNIPPET = "completeDetailTab1.do"
# 청약완료 목록: <a href="javascript:previewPage('ISCD', '1', this);">ELS 제30803회</a>
PREVIEW_PAGE_HREF_RE = re.compile(
    r"previewPage\s*\(\s*['\"](?P<iscd>[^'\"]+)['\"]\s*,\s*['\"](?P<typ>[12])['\"]",
    re.I,
)
SAMSUNG_ISCD_QUERY_RE = re.compile(r"ISCD=([A-Za-z0-9]+)", re.I)
SAMSUNG_ISCD_BODY_RE = re.compile(
    r"ingDetailTab1\.do\?[^\"'<>]*ISCD=([A-Za-z0-9]+)[^\"'<>]*", re.I
)
SAMSUNG_COMPLETE_ISCD_BODY_RE = re.compile(
    r"completeDetailTab1\.do\?[^\"'<>]*ISCD=([A-Za-z0-9]+)[^\"'<>]*", re.I
)


def _detail_url_ing_from_iscd(iscd: str, origin: str) -> str:
    base = origin.rstrip("/")
    return (
        f"{base}/ux/kor/finance/els/saleGoods/ingDetailTab1.do"
        f"?ISCD={iscd}&listGubun=N&ISCD_TYPE_CODE=2"
    )


def _detail_url_complete_from_iscd(iscd: str, origin: str) -> str:
    """청약완료 상품 상세 — previewPage(..., '1', ...) 가 여는 URL과 동일."""
    base = origin.rstrip("/")
    return (
        f"{base}/ux/kor/finance/els/saleGoods/completeDetailTab1.do"
        f"?ISCD={iscd}&listGubun=N&ISCD_TYPE_CODE=1"
    )


def _detail_url_from_iscd(iscd: str, origin: str) -> str:
    """하위 호환: 청약중 상세 URL."""
    return _detail_url_ing_from_iscd(iscd, origin)


def _parse_iscd_from_href(href: str) -> Optional[str]:
    if not href:
        return None
    m = SAMSUNG_ISCD_QUERY_RE.search(href)
    return m.group(1).upper() if m else None


def _collect_frames(page):
    """모든 프레임(메인·iframe). 검색 결과가 iframe 안에 있을 수 있음."""
    frames = list(getattr(page, "frames", []) or [])
    if not frames:
        yield page.main_frame
        return
    for fr in frames:
        yield fr



def _find_detail_links_in_frame(frame):
    """href에 ingDetailTab1.do 가 포함된 a 태그 locator (없으면 count 0)."""
    try:
        return frame.locator(f'a[href*="{SAMSUNG_DETAIL_PATH_SNIPPET}"]')
    except Exception:
        return None


def _find_complete_detail_links_in_frame(frame):
    try:
        return frame.locator(f'a[href*="{SAMSUNG_COMPLETE_DETAIL_SNIPPET}"]')
    except Exception:
        return None


def _score_anchor_for_round(text: str, round_s: str) -> int:
    t = (text or "").replace("\n", " ")
    t_compact = re.sub(r"\s+", "", t)
    score = 0
    if round_s and round_s in t_compact:
        score += 10
    if round_s and f"제{round_s}회" in t_compact:
        score += 8
    if round_s and round_s in t:
        score += 3
    if "ELS" in t.upper() or "ELB" in t.upper():
        score += 1
    return score


def _pick_detail_url_after_search(page, product_round: str, origin: str) -> Optional[str]:
    """
    검색 결과에서 상세 URL 결정.
    청약완료 탭은 상품명이 javascript:previewPage('ISCD','1',this) 이며
    실제 상세는 completeDetailTab1.do (ingDetailTab1.do 가 아님).
    """
    round_s = str(product_round).strip()
    base = origin.rstrip("/")
    candidates: list[tuple[int, str]] = []

    def collect_preview_in_frame(fr, root_css: str) -> None:
        try:
            loc = fr.locator(f"{root_css} a[href*='previewPage']")
            n = min(loc.count(), 100)
            for i in range(n):
                try:
                    a = loc.nth(i)
                    raw_href = a.get_attribute("href") or ""
                    href = raw_href.replace("\\'", "'")
                    m = PREVIEW_PAGE_HREF_RE.search(href)
                    if not m:
                        continue
                    iscd = m.group("iscd")
                    typ = m.group("typ")
                    if typ == "1":
                        url = _detail_url_complete_from_iscd(iscd, origin)
                    else:
                        url = _detail_url_ing_from_iscd(iscd, origin)
                    text = ""
                    try:
                        text = (a.inner_text(timeout=2000) or "").replace("\n", " ")
                    except Exception:
                        pass
                    score = _score_anchor_for_round(text, round_s)
                    if typ == "1":
                        score += 2
                    candidates.append((score, url))
                except Exception:
                    continue
        except Exception:
            pass

    for fr in _collect_frames(page):
        collect_preview_in_frame(fr, "#com_p_tb_div")

    if not candidates:
        for fr in _collect_frames(page):
            collect_preview_in_frame(fr, "body")

    for fr in _collect_frames(page):
        for finder in (_find_complete_detail_links_in_frame, _find_detail_links_in_frame):
            try:
                loc = finder(fr)
                if loc is None or loc.count() == 0:
                    continue
                n = min(loc.count(), 40)
                for i in range(n):
                    try:
                        a = loc.nth(i)
                        href = a.get_attribute("href") or ""
                        if not href:
                            continue
                        if href.startswith("/"):
                            href = base + href
                        elif href.startswith("javascript:"):
                            continue
                        text = ""
                        try:
                            text = (a.inner_text(timeout=2000) or "").replace("\n", " ")
                        except Exception:
                            pass
                        score = _score_anchor_for_round(text, round_s)
                        candidates.append((score, href))
                    except Exception:
                        continue
            except Exception:
                continue

    if not candidates:
        return None
    candidates.sort(key=lambda x: -x[0])
    best_score, best_url = candidates[0]
    if best_score == 0 and len(candidates) > 1:
        return None
    return best_url


def _select_search_type_round_name(page) -> None:
    """
    청약완료 탭 상단 검색 드롭다운에서「회차명」을 선택.
    실제 DOM: <select id="searchType"><option value="1">회차명</option>...</select>
    """
    try:
        page.select_option("#searchType", value="1", timeout=5000)
    except Exception:
        try:
            page.evaluate(
                """() => {
                    const s = document.getElementById('searchType');
                    if (s) { s.value = '1'; s.dispatchEvent(new Event('change', {bubbles:true})); }
                }"""
            )
        except Exception:
            pass


def _submit_completed_tab_round_search(page, round_s: str) -> bool:
    """
    회차 입력 후 검색 실행.
    실제 DOM:
      - 입력: <input id="searchGoodsName" ...>  (placeholder 속성 없음, label 오버레이)
      - 라벨 숨기기: <label id="searchTextBoxLabel">회차를 입력하세요.</label>
      - 검색: <a id="btnGoodsSearch" href="javascript:search();">검색</a>
      - 탭 2일 때 href가 javascript:search('complete'); 로 바뀜
    """
    # 1) JS evaluate로 값 넣기 + search('complete') 호출
    try:
        ok = page.evaluate(
            """(round) => {
                const input = document.getElementById('searchGoodsName');
                if (!input) return false;
                input.value = String(round);
                input.dispatchEvent(new Event('input', {bubbles:true}));
                input.dispatchEvent(new Event('change', {bubbles:true}));
                // 라벨 숨기기
                const lbl = document.getElementById('searchTextBoxLabel');
                if (lbl) lbl.style.display = 'none';
                // search() 호출 — 탭 2에서는 search('complete')
                if (typeof search === 'function') {
                    search('complete');
                    return true;
                }
                // 폴백: 버튼 직접 클릭
                const btn = document.getElementById('btnGoodsSearch');
                if (btn) { btn.click(); return true; }
                return false;
            }""",
            round_s,
        )
        if ok:
            return True
    except Exception:
        pass

    # 2) Playwright 폴백: locator로 입력 + 클릭
    try:
        inp = page.locator("#searchGoodsName")
        if inp.count():
            inp.click(timeout=3000)
            inp.fill(round_s, timeout=3000)
            btn = page.locator("#btnGoodsSearch")
            if btn.count():
                btn.click(timeout=5000)
                return True
    except Exception:
        pass

    return False


def _wait_for_search_ui_visible(page, timeout_ms: int = 12000) -> None:
    """#searchTextBox(검색바 래퍼)가 표시될 때까지 대기."""
    try:
        page.locator("#searchTextBox").wait_for(state="visible", timeout=timeout_ms)
    except Exception:
        try:
            page.locator("#searchGoodsName").wait_for(state="visible", timeout=5000)
        except Exception:
            pass


def _run_completed_tab_search_by_round(
    page, round_s: str, navigation_wait_ms: int
) -> Optional[str]:
    """청약완료 탭에서 회차 검색 실행. 실패 시 사람이 읽을 에러 문자열."""
    if not round_s:
        return "상품회차가 비어 있습니다."

    page.wait_for_timeout(400)
    _wait_for_search_ui_visible(page, timeout_ms=12000)
    _select_search_type_round_name(page)
    page.wait_for_timeout(250)

    if not _submit_completed_tab_round_search(page, round_s):
        return (
            "청약완료상품 화면에서 회차 입력란 또는「검색」버튼을 찾지 못했습니다. "
            "페이지 구조가 바뀌었는지 확인하세요."
        )

    try:
        page.wait_for_load_state("domcontentloaded", timeout=navigation_wait_ms)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    return None


def _ensure_els_dls_tab(page, tab_val: str) -> None:
    """
    ELS/DLS 찾기 상단 탭 전환. 사이트 기준: '1' 청약중인상품, '2' 청약완료상품.
    """
    try:
        page.evaluate(
            f"""() => {{
                try {{
                    if (typeof elsDlsChkTab === 'function') elsDlsChkTab('{tab_val}');
                }} catch (e) {{}}
            }}"""
        )
    except Exception:
        pass
    for sel in (
        f'a[href*="elsDlsChkTab(\'{tab_val}\')"]',
        f'a[href*="elsDlsChkTab(\\"{tab_val}\\")"]',
    ):
        try:
            loc = page.locator(sel).first
            if loc.count():
                loc.click(timeout=5000)
                break
        except Exception:
            continue
    page.wait_for_timeout(1200)


def _iscd_from_page_html(page) -> Optional[str]:
    """링크를 못 찾을 때 HTML에서 ISCD 패턴 스캔."""
    try:
        html = page.content()
    except Exception:
        return None
    for rx in (SAMSUNG_COMPLETE_ISCD_BODY_RE, SAMSUNG_ISCD_BODY_RE):
        found = rx.findall(html)
        if found:
            return found[0].upper()
    m = PREVIEW_PAGE_HREF_RE.search(html.replace("\\'", "'"))
    if m:
        return m.group("iscd").upper()
    return None


def open_samsung_els_detail_page(
    page,
    product_round: str,
    detail_url_template: Optional[str],
    navigation_wait_ms: int,
) -> Optional[str]:
    """
    상품 상세 페이지까지 이동. 실패 시 에러 메시지 문자열 반환, 성공 시 None.
    우선순위: 1) SAMSUNG_ELS_DETAIL_URL_TEMPLATE ({round})
              2) search.do → 청약완료상품 탭 → 회차명 검색 → 결과에서 상세 링크
    """
    round_s = str(product_round).strip()

    if detail_url_template and "{round}" in detail_url_template:
        try:
            url = detail_url_template.replace("{round}", round_s)
            page.goto(url, wait_until="domcontentloaded", timeout=navigation_wait_ms)
            return None
        except Exception as e:
            return f"템플릿 URL 이동 실패: {e}"

    search_url = (
        os.getenv("SAMSUNG_ELS_SEARCH_URL", DEFAULT_SAMSUNG_ELS_SEARCH_URL).strip()
        or DEFAULT_SAMSUNG_ELS_SEARCH_URL
    )
    origin = f"{urlparse(search_url).scheme}://{urlparse(search_url).netloc}"
    completed_tab = (os.getenv("SAMSUNG_ELS_COMPLETED_TAB", "2") or "2").strip()

    try:
        page.goto(search_url, wait_until="domcontentloaded", timeout=navigation_wait_ms)
    except Exception as e:
        return f"ELS/DLS 찾기 페이지 로드 실패: {e}"

    page.wait_for_timeout(600)
    _ensure_els_dls_tab(page, completed_tab)

    try:
        page.wait_for_load_state("domcontentloaded", timeout=navigation_wait_ms)
    except Exception:
        pass
    page.wait_for_timeout(500)

    search_err = _run_completed_tab_search_by_round(page, round_s, navigation_wait_ms)
    if search_err:
        return search_err

    try:
        page.locator("#com_p_tb_div a[href*='previewPage']").first.wait_for(
            state="visible", timeout=min(navigation_wait_ms, 20000)
        )
    except Exception:
        page.wait_for_timeout(1500)

    detail_url = _pick_detail_url_after_search(page, round_s, origin)
    if detail_url:
        try:
            page.goto(detail_url, wait_until="domcontentloaded", timeout=navigation_wait_ms)
            return None
        except Exception as e:
            return f"상세 URL 이동 실패: {e}"

    iscd = _iscd_from_page_html(page)
    if iscd:
        try:
            page.goto(
                _detail_url_complete_from_iscd(iscd, origin),
                wait_until="domcontentloaded",
                timeout=navigation_wait_ms,
            )
            return None
        except Exception as e:
            return f"ISCD 상세(청약완료) 이동 실패: {e}"

    return (
        "회차 검색 후 결과에서 해당 상세 링크(또는 ISCD)를 찾지 못했습니다. "
        "회차·탭(SAMSUNG_ELS_COMPLETED_TAB)을 확인하세요."
    )


def _normalize_sheet_date_slash(d: str) -> str:
    """2026/06/09 → 2026-06-09 (시트 날짜 열용)."""
    s = (d or "").strip()
    m = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s


def _current_price_formula(ticker: str) -> str:
    """스프레드시트용: =KOSPI200현재가 형태. S&P500 만 =SNP500현재가 (명명된 범위와 맞춤)."""
    t = (ticker or "").strip()
    if not t:
        return ""
    if t == "S&P500":
        return "=SNP500현재가"
    return f"={t}현재가"


def _parse_issue_date_from_tab1_text(text: str) -> Optional[date]:
    """'발행일 2026년 03월 11일' → date."""
    m = re.search(
        r"발행일\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",
        text,
    )
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


# 상품정보 표에서 '기초자산' 행 다음 칸에 오는 열 제목(티커 아님)
_TAB1_UNDERLYING_HEADER_COMPACT = frozenset(
    re.sub(r"\s+", "", p)
    for p in (
        "차기 행사가격",
        "종가",
        "행사가격",
        "기준가",
        "현재가",
        "관련일자",
        "관련 일자",
        "기준가대비",
        "상환시",
        "상환 시",
        "평가가격",
    )
)


def _tab1_underlying_header_cell(s: str) -> bool:
    c = (s or "").strip()
    if not c:
        return False
    if re.sub(r"\s+", "", c) in _TAB1_UNDERLYING_HEADER_COMPACT:
        return True
    if re.match(r"^\(.*\d{4}[./]\d", c):
        return True
    return False


def _tab1_cell_looks_like_table_number(s: str) -> bool:
    t = (s or "").strip().replace(",", "")
    if re.fullmatch(r"[\d.]+%?", t):
        return True
    if re.fullmatch(r"-?[\d.]+", t):
        return True
    if re.match(r"^\d{4}/\d", t):
        return True
    return False


def _tab1_line_ends_underlying_name_block(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if s.startswith(
        (
            "청약기간",
            "발행일",
            "최초기준가격",
            "하락한계가격",
            "위험등급",
            "지급여부",
            "특정조건",
        )
    ):
        return True
    if re.match(r"^\d+차\s*중간기준가격", s):
        return True
    return False


def _is_plausible_underlying_ticker_name(s: str) -> bool:
    if not s or len(s) > 48:
        return False
    if _tab1_underlying_header_cell(s):
        return False
    t = s.strip()
    if re.sub(r"\s+", "", t) == "기초자산":
        return False
    if "%" in t:
        return False
    if re.search(r"세전|월수익|조기상환|최대\s*손실|원금", t):
        return False
    if re.fullmatch(r"[\d,.\s%+\-]+", t):
        return False
    if re.match(r"^\d{4}\s*년", t):
        return False
    if re.match(r"^\d{4}[./-]\d", t):
        return False
    if re.match(r"^\(.*\d{4}[./]\d", t):
        return False
    return True


def _parse_top_summary_underlying_cell_text(raw: str) -> list[str]:
    """
    최상단 요약「기초자산」셀 innerText → Nikkei225 / HSCEI / KOSPI200 등 순서 유지, 최대 3개.
    """
    if not raw or not raw.strip():
        return []
    out: list[str] = []
    for line in raw.replace("\r", "").split("\n"):
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^[\s•·\-\u200b]+", "", line)
        line = line.strip()
        if not line:
            continue
        if _is_plausible_underlying_ticker_name(line):
            if line not in out:
                out.append(line)
            continue
        for tok in re.split(r"[\t]+|\s{2,}", line):
            t = tok.strip()
            if t and _is_plausible_underlying_ticker_name(t) and t not in out:
                out.append(t)
        if len(out) >= 3:
            break
    if not out:
        for chunk in re.split(r"[,，、]+", raw):
            t = chunk.strip()
            if t and _is_plausible_underlying_ticker_name(t) and t not in out:
                out.append(t)
            if len(out) >= 3:
                break
    return out[:3]


def _scrape_detail_page_top_summary_tickers(page) -> list[str]:
    """
    상세 페이지 메인 문서 최상단 요약 표의「기초자산」값만 사용 (상품정보 iframe과 별개).
    목록 카드와 동일하게 dl.detailDefin dt/dd 패턴이 많음.
    """
    raw: Optional[str] = None
    try:
        loc = page.locator(
            "xpath=//dt[contains(normalize-space(.),'기초자산')]/following-sibling::dd[1]"
        )
        if loc.count() > 0:
            t = loc.first.inner_text(timeout=8000)
            if t and t.strip():
                raw = t.strip()
    except Exception:
        pass

    if not raw:
        for dl_sel in ("dl.detailDefin", "dl.prdDefin"):
            try:
                if page.locator(dl_sel).count() > 0:
                    dl = page.locator(dl_sel).first
                    dts = dl.locator("dt")
                    dds = dl.locator("dd")
                    n = min(dts.count(), dds.count())
                    for i in range(n):
                        try:
                            lab = dts.nth(i).inner_text(timeout=5000).strip()
                        except Exception:
                            continue
                        if "기초자산" not in lab:
                            continue
                        try:
                            val = dds.nth(i).inner_text(timeout=5000).strip()
                        except Exception:
                            continue
                        if val:
                            raw = val
                            break
                    if raw:
                        break
            except Exception:
                pass

    if not raw:
        try:
            loc = page.locator(
                "xpath=//*[self::th or self::td]"
                "[contains(normalize-space(.),'기초자산')]"
                "/following-sibling::*[self::td or self::th or self::div][1]"
            )
            if loc.count() > 0:
                t = loc.first.inner_text(timeout=8000)
                if t and t.strip():
                    raw = t.strip()
        except Exception:
            pass

    if not raw:
        try:
            lis = page.locator("ul.product_list.elsCols > li")
            for j in range(lis.count()):
                li = lis.nth(j)
                if li.locator("span.grayTxt").count() == 0:
                    continue
                try:
                    lab = li.locator("span.grayTxt").first.inner_text(timeout=4000).strip()
                except Exception:
                    continue
                if "기초자산" not in lab:
                    continue
                try:
                    raw = li.inner_text(timeout=5000).strip()
                except Exception:
                    continue
                if raw:
                    break
        except Exception:
            pass

    if not raw:
        try:
            raw = _extract_labeled_value(page, ("기초자산",))
        except Exception:
            raw = None

    if not raw:
        return []
    return _parse_top_summary_underlying_cell_text(raw)


def _tab1_same_line_is_underlying_header_only_row(s: str) -> bool:
    """예: `차기 행사가격\\t종가` — 표 열 제목만 있는 첫 줄."""
    raw = (s or "").strip()
    if not raw:
        return False
    if "\t" in raw:
        cells = [p.strip() for p in raw.split("\t") if p.strip()]
        return len(cells) > 0 and all(_tab1_underlying_header_cell(p) for p in cells)
    compact = re.sub(r"\s+", "", raw)
    if len(compact) <= 40 and "차기" in raw and "행사가격" in raw and "종가" in raw:
        return True
    return False


def _parse_underlying_tickers_from_tab1_text(text: str) -> list[str]:
    """
    `기초자산` 라벨 이후: 표면 `차기 행사가격`/`종가` 열 제목만 잡히는 경우 다음 줄의 첫 열을 티커로 사용.
    탭 없이 줄마다 지수명만 있는 형식도 지원.
    """
    m = re.search(r"기초자산", text)
    if not m:
        return []
    line_end = text.find("\n", m.end())
    if line_end < 0:
        line_end = len(text)
    same_line = text[m.end() : line_end].strip()
    following = text[line_end + 1 :]

    tickers: list[str] = []

    def append_ticker(name: str) -> None:
        t = name.strip()
        if t and t not in tickers and _is_plausible_underlying_ticker_name(t):
            tickers.append(t)

    if _tab1_same_line_is_underlying_header_only_row(same_line):
        for line in following.split("\n"):
            ls = line.strip()
            if not ls:
                continue
            if _tab1_line_ends_underlying_name_block(ls):
                break
            first = ls.split("\t", 1)[0].strip()
            if not first or _tab1_underlying_header_cell(first):
                continue
            append_ticker(first)
            if len(tickers) >= 3:
                break
        return tickers[:3]

    if "\t" in same_line:
        cells = [p.strip() for p in same_line.split("\t") if p.strip()]
        if cells and _is_plausible_underlying_ticker_name(cells[0]):
            second = cells[1] if len(cells) > 1 else ""
            if second and (
                _tab1_underlying_header_cell(second)
                or _tab1_cell_looks_like_table_number(second)
            ):
                append_ticker(cells[0])
                for line in following.split("\n"):
                    ls = line.strip()
                    if not ls:
                        continue
                    if _tab1_line_ends_underlying_name_block(ls):
                        break
                    row = [p.strip() for p in ls.split("\t") if p.strip()]
                    if not row:
                        continue
                    if _tab1_underlying_header_cell(row[0]):
                        continue
                    append_ticker(row[0])
                    if len(tickers) >= 3:
                        break
                return tickers[:3]
        non_header = [c for c in cells if not _tab1_underlying_header_cell(c)]
        plausible = [c for c in non_header if _is_plausible_underlying_ticker_name(c)]
        if plausible and len(plausible) == len(non_header):
            return plausible[:3]

    if re.search(r"[,，/|]", same_line):
        parts = [p.strip() for p in re.split(r"[,，/|]\s*", same_line) if p.strip()]
        parts = [
            p
            for p in parts
            if not _tab1_underlying_header_cell(p) and _is_plausible_underlying_ticker_name(p)
        ]
        if parts:
            return parts[:3]

    if same_line and _is_plausible_underlying_ticker_name(same_line):
        return [same_line.strip()][:3]

    for line in following.split("\n"):
        ls = line.strip()
        if not ls:
            continue
        if _tab1_line_ends_underlying_name_block(ls):
            break
        first = ls.split("\t", 1)[0].strip() if "\t" in ls else ls.strip()
        if _tab1_underlying_header_cell(first):
            continue
        append_ticker(first)
        if len(tickers) >= 3:
            break

    return tickers[:3]


def parse_tab1_inner_text_to_sheet_fields(
    text: str, summary_tickers: Optional[list[str]] = None
) -> dict[str, str]:
    """
    상품정보 iframe #tab1FileLoadPage1_1 의 innerText 를 시트 열 이름에 맞게 파싱.
    티커1~3는 summary_tickers(최상단 요약「기초자산」)가 있으면 그것만 쓰고, 없을 때만 탭1 본문에서 파싱한다.
    """
    out: dict[str, str] = {}
    if not text or len(text.strip()) < 80:
        return out

    # 수익률: 세전 연 12% → 12%
    m = re.search(r"세전\s*연\s*([\d.]+)\s*%", text)
    if m:
        out["수익률"] = f"{m.group(1)}%"
    else:
        m2 = re.search(
            r"각\s*중간기준가격\s*결정일에[\s\S]{0,200}?연\s*([\d.]+)\s*%",
            text,
        )
        if m2:
            out["수익률"] = f"{m2.group(1)}%"

    # KI: 하락한계가격 행의 행사가격 열 (예: 50%)
    m = re.search(
        r"하락한계가격\s+[-–\s]*\s+[-–\s]*\s+([\d.]+%)",
        text,
    )
    if m:
        out["KI"] = m.group(1)

    # 1~11차: 중간기준가격 행 → 관련일자, 상환시 수익률, 행사가격, 기준가대비
    for match in re.finditer(
        r"(\d+)차\s*중간기준가격\s+([\d/]+)\s+([\d.]+%)\s+([\d.]+%)\s+([\d.]+)",
        text,
    ):
        i = int(match.group(1))
        if 1 <= i <= 11:
            out[f"{i}차"] = match.group(4)
            out[f"{i}차 평가일"] = _normalize_sheet_date_slash(match.group(2))

    # 12차: 최종기준가격 행
    m = re.search(
        r"최종기준가격\s+([\d/]+)\s+([^\s]+%)\s+([\d.]+%)\s+([\d.]+)",
        text,
    )
    if m:
        out["12차"] = m.group(3)
        out["12차 평가일"] = _normalize_sheet_date_slash(m.group(1))

    # 티커1~3: 최상단 요약 우선, 없으면 탭1 표(차기 행사가격·종가 등 헤더 제외)
    st = [x.strip() for x in (summary_tickers or []) if x and str(x).strip()]
    if st:
        tickers = st[:3]
    else:
        tickers = _parse_underlying_tickers_from_tab1_text(text)
    for idx, t in enumerate(tickers[:3], start=1):
        out[f"티커{idx}"] = t

    # 최초기준가격 행 (기초자산별로 여러 줄일 수 있음)
    for i, mm in enumerate(
        re.finditer(r"최초기준가격\s+([\d/]+)\s+-\s+-\s+([\d.]+)", text),
        start=1,
    ):
        if i <= 3:
            out[f"기준가{i}"] = mm.group(2)

    # 현재가: 스크래핑 숫자 대신 수식 (티커 파싱 후)
    for idx in range(1, 4):
        tk = out.get(f"티커{idx}", "").strip()
        if tk:
            out[f"현재가{idx}"] = _current_price_formula(tk)

    return out


def _find_tab1_iframe_frame(page):
    """상품정보 탭 iframe (saleGoodsFileLoad.pop, tabType=1)."""
    for fr in page.frames:
        u = fr.url or ""
        if "saleGoodsFileLoad.pop" in u and "tabType=1" in u:
            return fr
    return None


def _wait_tab1_ajax_and_get_inner_text(page, timeout_ms: int) -> Optional[str]:
    """AJAX 로드 후 #tab1FileLoadPage1_1 텍스트."""
    fr = _find_tab1_iframe_frame(page)
    if not fr:
        return None
    try:
        fr.wait_for_function(
            """() => {
                const el = document.querySelector('#tab1FileLoadPage1_1');
                if (!el) return false;
                const t = (el.innerText || '').trim();
                return t.length > 80 && !el.classList.contains('no_dataBox');
            }""",
            timeout=timeout_ms,
        )
    except Exception:
        try:
            fr.wait_for_timeout(2000)
        except Exception:
            pass
    try:
        box = fr.locator("#tab1FileLoadPage1_1")
        if box.count() == 0:
            return None
        return box.inner_text(timeout=10000)
    except Exception:
        return None


def scrape_samsung_els_detail(
    page,
    product_round: str,
    detail_url_template: Optional[str],
    navigation_wait_ms: int,
) -> dict[str, Any]:
    """
    삼성증권 ELS 상세에서 필드 추출.
    - 티커: 메인 문서 최상단 요약「기초자산」.
    - 수익률·KI·차수 등: iframe 상품정보 탭 AJAX(#tab1FileLoadPage1_1) 텍스트 파싱.
    시트에 넣을 값은 SHEET_COLUMNS_SCRAPER_FILLS_ORDER 에 나열된 항목만 채운다.
    """
    data: dict[str, Any] = {}

    try:
        nav_err = open_samsung_els_detail_page(
            page, str(product_round), detail_url_template, navigation_wait_ms
        )
        if nav_err:
            data["_error"] = nav_err
            return data

        page.wait_for_timeout(500)
        summary_tickers = _scrape_detail_page_top_summary_tickers(page)

        ajax_timeout = min(max(navigation_wait_ms, 15000), 60000)
        tab1_text = _wait_tab1_ajax_and_get_inner_text(page, ajax_timeout)
        if not tab1_text:
            data["_error"] = (
                "상품정보 iframe(tab1) 또는 AJAX 내용(#tab1FileLoadPage1_1)을 읽지 못했습니다."
            )
            return data

        issue_d = _parse_issue_date_from_tab1_text(tab1_text)
        today = date.today()
        if issue_d is not None and today < issue_d:
            data["_skip_reason"] = "not_issued"
            return data

        parsed = parse_tab1_inner_text_to_sheet_fields(
            tab1_text, summary_tickers=summary_tickers or None
        )
        for k, v in parsed.items():
            if v and str(v).strip():
                data[k] = str(v).strip()

        if not data.get("수익률") and not data.get("티커1"):
            data["_error"] = "상품정보 파싱 결과가 비었습니다. 페이지 문구가 바뀌었는지 확인하세요."

    except PlaywrightTimeoutError:
        data["_error"] = "navigation_timeout"
    except Exception as ex:
        data["_error"] = str(ex)

    return data


def post_update(api_base: str, row_index: int, payload: dict[str, Any], timeout: float = 60.0) -> None:
    body = {"action": "update", "row_index": row_index, **payload}
    # 프런트엔드와 동일하게 text/plain + UTF-8 JSON (str 그대로 넣으면 requests가 latin-1로 인코딩 시도해 한글 키에서 실패)
    raw = json.dumps(body, ensure_ascii=False)
    r = requests.post(
        api_base,
        data=raw.encode("utf-8"),
        timeout=timeout,
        headers={
            "Content-Type": "text/plain;charset=utf-8",
            "Accept": "application/json",
        },
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
        print(
            "조건에 맞는 상품이 없습니다. "
            "(상태「청약 중(대기)」, 삼성증권, 시트「발행일」≤오늘, 「수익률」비어 있음)"
        )
        return 0

    # 선택: 직접 상세 URL 템플릿이 있으면 search.do 보다 우선 (예: ...?ISCD=...&... 에 {round} 치환 불가 시 생략)
    detail_template = os.getenv("SAMSUNG_ELS_DETAIL_URL_TEMPLATE", "").strip() or None
    nav_timeout = int(os.getenv("PLAYWRIGHT_NAV_TIMEOUT_MS", "45000"))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(locale="ko-KR")
        page = context.new_page()

        for row in targets:
            row_index = row.get("row_index")
            product_round = row.get("상품회차")
            if row_index is None or product_round is None:
                print(f"건너뜀: row_index/상품회차 없음 — {row!r}")
                continue

            print(f"처리 중: row_index={row_index}, 상품회차={product_round}")
            try:
                scraped = scrape_samsung_els_detail(
                    page, str(product_round), detail_template, nav_timeout
                )
            except Exception as e:
                print(f"  스크래핑 예외: {e}")
                continue

            if scraped.get("_skip_reason") == "not_issued":
                print("  아직 발행되지 않음 (입고일/발행일 이전)")
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

        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
