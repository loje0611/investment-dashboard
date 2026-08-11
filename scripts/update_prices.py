#!/usr/bin/env python3
"""
Investment Dashboard — Real-Time Market Price Auto-Updater
Reads src/data/portfolio.csv, fetches live prices for US/KR ETFs and stocks,
and updates portfolio.csv (보유종목_* rows: 현재가, 평가금액, 현재비중).
"""

import csv
import json
import os
import re
import sys
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'portfolio.csv')

# 상품명 → 네이버 금융 6자리 종목코드
KR_ETF_NAME_TO_CODE = {
    'KODEX 미국S&P500': '379800',
    'KODEX 미국나스닥100': '379810',
    'TIGER 미국필라델피아반도체나스닥': '381180',
    'KODEX 미국AI테크TOP10': '485540',
    'ACE 미국30년국채액티브': '453850',
    'TIME 글로벌AI인공지능액티브': '456600',
    'TIGER 미국배당다우존스': '458730',
}

COL_CATEGORY = 0
COL_NAME = 1
COL_PRINCIPAL = 3
COL_VALUATION = 4
COL_WEIGHT = 5
COL_STATUS = 6
COL_NOTES = 7
COL_QUANTITY = 8
COL_CURRENT_PRICE = 9
COL_TARGET_WEIGHT = 10

HOLDING_PREFIX = '보유종목_'

_price_cache: dict[str, tuple[float, str]] = {}


def get_usd_krw_rate() -> float:
    try:
        url = 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=10).read().decode('utf-8'))
        return float(res['chart']['result'][0]['meta']['regularMarketPrice'])
    except Exception:
        return 1470.0


def get_kr_stock_price(code: str) -> float | None:
    cache_key = f'KR:{code}'
    if cache_key in _price_cache:
        return _price_cache[cache_key][0]
    try:
        url = f'https://m.stock.naver.com/api/stock/{code}/basic'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=10).read().decode('utf-8'))
        price_str = str(res['closePrice']).replace(',', '')
        price = float(price_str)
        _price_cache[cache_key] = (price, res.get('stockName', code))
        return price
    except Exception:
        return None


def get_us_stock_price(ticker: str) -> float | None:
    cache_key = f'US:{ticker}'
    if cache_key in _price_cache:
        return _price_cache[cache_key][0]
    try:
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=10).read().decode('utf-8'))
        meta = res['chart']['result'][0]['meta']
        price = float(meta['regularMarketPrice'])
        _price_cache[cache_key] = (price, meta.get('symbol', ticker))
        return price
    except Exception:
        return None


def pad_row(row: list[str], min_len: int = 11) -> list[str]:
    if len(row) < min_len:
        row = row + [''] * (min_len - len(row))
    return row


def resolve_ticker(name: str) -> tuple[str | None, str | None]:
    name = name.strip()
    if re.match(r'^[A-Z]{2,5}$', name):
        return name, 'USD'
    for key, code in KR_ETF_NAME_TO_CODE.items():
        if key in name:
            return code, 'KRW'
    return None, None


def format_price(price: float, currency: str) -> str:
    if currency == 'KRW':
        return str(int(round(price)))
    return f'{price:.10g}'


def format_valuation(valuation: float) -> str:
    if abs(valuation - round(valuation)) < 0.01:
        return str(int(round(valuation)))
    return f'{valuation:.10g}'


def format_weight(weight_pct: float) -> str:
    rounded = round(weight_pct, 1)
    if abs(rounded - round(rounded)) < 0.05:
        return f'{int(round(rounded))}%'
    return f'{rounded}%'


def fetch_price_krw(ticker: str, currency: str, usd_krw: float) -> float | None:
    if currency == 'KRW':
        return get_kr_stock_price(ticker)
    usd_price = get_us_stock_price(ticker)
    if usd_price is None:
        return None
    return usd_price * usd_krw


def main() -> None:
    portfolio_path = os.path.normpath(PORTFOLIO_CSV_PATH)
    if not os.path.exists(portfolio_path):
        print(f'Error: {portfolio_path} not found.')
        sys.exit(1)

    print('=' * 60)
    print(' INVESTMENT DASHBOARD REAL-TIME PRICE AUTO-UPDATER')
    print('=' * 60)

    usd_krw = get_usd_krw_rate()
    print(f'Live USD/KRW Exchange Rate: {usd_krw:,.2f} KRW\n')

    with open(portfolio_path, 'r', encoding='utf-8', newline='') as f:
        rows = list(csv.reader(f))

    if not rows:
        print('Empty portfolio CSV.')
        sys.exit(1)

    header = rows[0]
    data_rows = [pad_row(list(row)) for row in rows[1:]]

    # 계좌별 보유종목 인덱스 수집
    account_indices: dict[str, list[int]] = {}
    for idx, row in enumerate(data_rows):
        category = row[COL_CATEGORY]
        if category.startswith(HOLDING_PREFIX):
            account = category[len(HOLDING_PREFIX):]
            account_indices.setdefault(account, []).append(idx)

    updated_count = 0
    skipped: list[str] = []

    for account, indices in account_indices.items():
        for idx in indices:
            row = data_rows[idx]
            name = row[COL_NAME].strip()
            ticker, currency = resolve_ticker(name)
            if not ticker:
                skipped.append(name)
                continue

            quantity = float(row[COL_QUANTITY].replace(',', '') or '0')
            if quantity <= 0:
                skipped.append(f'{name} (수량 없음)')
                continue

            price_krw = fetch_price_krw(ticker, currency, usd_krw)
            if price_krw is None:
                skipped.append(f'{name} ({ticker})')
                continue

            valuation = quantity * price_krw
            row[COL_CURRENT_PRICE] = format_price(price_krw, currency)
            row[COL_VALUATION] = format_valuation(valuation)
            updated_count += 1
            print(f'  Updated [{name} ({ticker})]: {price_krw:,.2f} KRW')

        # 계좌 내 현재비중 재계산
        total_val = 0.0
        valuations: list[tuple[int, float]] = []
        for idx in indices:
            row = data_rows[idx]
            val = float(row[COL_VALUATION].replace(',', '') or '0')
            valuations.append((idx, val))
            total_val += val

        if total_val > 0:
            for idx, val in valuations:
                weight = (val / total_val) * 100
                data_rows[idx][COL_WEIGHT] = format_weight(weight)

    with open(portfolio_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(data_rows)

    print('\n' + '=' * 60)
    print(f' RESULT: {updated_count} holdings updated → {portfolio_path}')
    if skipped:
        print(f' Skipped ({len(skipped)}): {", ".join(skipped[:5])}')
        if len(skipped) > 5:
            print(f'   ... and {len(skipped) - 5} more')
    print('=' * 60)


if __name__ == '__main__':
    main()
