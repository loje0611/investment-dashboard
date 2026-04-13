# -*- coding: utf-8 -*-
"""
ELS 스크래퍼 공통 모듈.

삼성·메리츠·키움 스크래퍼가 공유하는 상수, 유틸리티 함수,
API 호출/시트 업데이트 로직을 한 곳에 모아 중복을 제거한다.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
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

# ---------------------------------------------------------------------------
# 시트 열 순서 (G열부터 — A~F는 수동/대시보드)
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# 로깅
# ---------------------------------------------------------------------------
_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"


def setup_logging(name: str, *, level: int = logging.INFO) -> logging.Logger:
    """스크래퍼용 로거를 반환한다. 최초 호출 시 기본 핸들러를 설정."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger


# ---------------------------------------------------------------------------
# HTTP 재시도 래퍼
# ---------------------------------------------------------------------------
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_BACKOFF_BASE = 2.0


def request_with_retry(
    method: str,
    url: str,
    *,
    max_retries: int = _DEFAULT_MAX_RETRIES,
    backoff_base: float = _DEFAULT_BACKOFF_BASE,
    logger: Optional[logging.Logger] = None,
    **kwargs,
) -> requests.Response:
    """
    requests.request() 래퍼. 네트워크/5xx 오류 시 지수 백오프로 재시도한다.
    4xx 등 클라이언트 오류는 즉시 raise.
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.request(method, url, **kwargs)
            if resp.status_code >= 500:
                raise requests.HTTPError(
                    f"Server error {resp.status_code}", response=resp
                )
            resp.raise_for_status()
            return resp
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            last_exc = exc
            if attempt < max_retries:
                wait = backoff_base ** attempt
                if logger:
                    logger.warning(
                        "요청 실패 (%s/%s): %s — %.1f초 후 재시도",
                        attempt, max_retries, exc, wait,
                    )
                time.sleep(wait)
            else:
                if logger:
                    logger.error("요청 최종 실패: %s", exc)
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# URL 유틸리티
# ---------------------------------------------------------------------------

def append_query(url: str, **params: str) -> str:
    """기존 쿼리를 유지한 채 파라미터를 병합한다."""
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q.update({k: v for k, v in params.items() if v is not None})
    new_query = urlencode(q) if q else ""
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment)
    )


# ---------------------------------------------------------------------------
# 날짜 파싱
# ---------------------------------------------------------------------------

def parse_korean_date(text: str) -> Optional[date]:
    """'2026-03-28', '2026.03.28', '2026/03/28', '2026년 3월 28일' 등 → date."""
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


def parse_sheet_issue_date(value: Any) -> Optional[date]:
    """시트/API에서 내려온 발행일 값 → date."""
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


def normalize_date_str(d: str) -> str:
    """다양한 날짜 형식을 YYYY-MM-DD 로 정규화한다."""
    s = str(d).strip()
    m = re.search(r"(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m2 = re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if m2:
        return f"{m2.group(1)}-{m2.group(2)}-{m2.group(3)}"
    return s


# ---------------------------------------------------------------------------
# 값 판별
# ---------------------------------------------------------------------------

def is_empty_profit_rate(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


# ---------------------------------------------------------------------------
# 현재가 수식 (스프레드시트용)
# ---------------------------------------------------------------------------

_TICKER_FORMULA_MAP = {
    "S&P500": "=SNP500현재가",
    "S&P 500": "=SNP500현재가",
}
_TICKER_KEYWORD_MAP = [
    (("유로스탁스", "EURO", "EUROSTOXX"), "=EUROSTOXX50현재가"),
    (("니케이", "NIKKEI"), "=NIKKEI225현재가"),
    (("KOSPI", "코스피"), "=KOSPI200현재가"),
    (("HSCEI", "홍콩", "항셍"), "=HSCEI현재가"),
]


def current_price_formula(ticker: str) -> str:
    """스프레드시트 수식 반환. 예: KOSPI200 → =KOSPI200현재가, S&P500 → =SNP500현재가."""
    t = (ticker or "").strip()
    if not t:
        return ""
    if t in _TICKER_FORMULA_MAP:
        return _TICKER_FORMULA_MAP[t]
    t_upper = t.upper()
    for keywords, formula in _TICKER_KEYWORD_MAP:
        for kw in keywords:
            if kw.upper() in t_upper or kw in t:
                return formula
    return f"={t}현재가"


# ---------------------------------------------------------------------------
# Google Apps Script 웹앱 API
# ---------------------------------------------------------------------------

def fetch_els_items(
    api_base: str,
    *,
    timeout: float = 60.0,
    logger: Optional[logging.Logger] = None,
) -> list[dict[str, Any]]:
    """GET: 대기(청약 중) ELS 목록."""
    url = append_query(api_base, api="els_pending")
    r = request_with_retry(
        "GET", url,
        timeout=timeout,
        headers={"Accept": "application/json"},
        logger=logger,
    )
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


def filter_scrape_targets(
    items: list[dict[str, Any]],
    broker_name: str,
) -> list[dict[str, Any]]:
    """
    수익률 비어 있음 + 지정 증권사 + 발행일이 오늘 이전 또는 오늘인 행만 필터.
    발행일이 비어 있거나 파싱 불가면 제외.
    """
    today = date.today()
    out: list[dict[str, Any]] = []
    for row in items:
        if not is_empty_profit_rate(row.get("수익률")):
            continue
        broker = str(row.get("증권사", "")).strip()
        if broker != broker_name:
            continue
        issue_d = parse_sheet_issue_date(row.get("발행일"))
        if issue_d is None or issue_d > today:
            continue
        out.append(row)
    return out


def post_update(
    api_base: str,
    row_index: int,
    payload: dict[str, Any],
    *,
    timeout: float = 60.0,
    logger: Optional[logging.Logger] = None,
) -> None:
    """시트 행 업데이트 POST."""
    body = {"action": "update", "row_index": row_index, **payload}
    raw = json.dumps(body, ensure_ascii=False)
    r = request_with_retry(
        "POST", api_base,
        data=raw.encode("utf-8"),
        timeout=timeout,
        headers={
            "Content-Type": "text/plain;charset=utf-8",
            "Accept": "application/json",
        },
        logger=logger,
    )
    resp = r.json()
    if isinstance(resp, dict) and not resp.get("success"):
        raise RuntimeError(resp.get("error", "업데이트 실패"))


def build_update_body(scraped: dict[str, Any]) -> dict[str, Any]:
    """SHEET_COLUMNS_SCRAPER_FILLS_ORDER 에 해당하는 비어 있지 않은 필드만 추출."""
    return {
        k: scraped[k]
        for k in SHEET_COLUMNS_SCRAPER_FILLS_ORDER
        if k in scraped and scraped[k] is not None and str(scraped[k]).strip()
    }


# ---------------------------------------------------------------------------
# .env 로드 헬퍼
# ---------------------------------------------------------------------------

def load_env() -> str:
    """
    .env 를 로드하고 VITE_WEB_APP_URL 을 반환한다.
    값이 비어 있으면 SystemExit.
    """
    load_dotenv()
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_path = os.path.join(root, ".env")
    if os.path.isfile(env_path):
        load_dotenv(env_path)

    api_base = (os.getenv("VITE_WEB_APP_URL") or "").strip()
    if not api_base:
        raise SystemExit("VITE_WEB_APP_URL이 .env에 없습니다.")
    return api_base
