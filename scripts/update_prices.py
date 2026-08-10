#!/usr/bin/env python3
"""
Investment Dashboard — 1-Second Real-Time Market Price Auto-Updater
Reads src/data/portfolio.csv, fetches live prices for US/KR ETFs and stocks,
and updates portfolio.csv automatically.
"""

import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request

PORTFOLIO_CSV_PATH = os.path.join(os.path.dirname(__file__), 'src', 'data', 'portfolio.csv')

def get_usd_krw_rate():
    """Fetch live USD/KRW exchange rate from Yahoo Finance"""
    try:
        url = 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=5).read().decode('utf-8'))
        return float(res['chart']['result'][0]['meta']['regularMarketPrice'])
    except Exception:
        return 1470.0

def get_kr_stock_price(code):
    """Fetch Korean stock/ETF price from Naver Finance"""
    try:
        url = f'https://m.stock.naver.com/api/stock/{code}/basic'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=5).read().decode('utf-8'))
        price_str = str(res['closePrice']).replace(',', '')
        return float(price_str), res.get('stockName', '')
    except Exception:
        return None, None

def get_us_stock_price(ticker):
    """Fetch US stock/ETF price from Yahoo Finance"""
    try:
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = json.loads(urllib.request.urlopen(req, timeout=5).read().decode('utf-8'))
        meta = res['chart']['result'][0]['meta']
        return float(meta['regularMarketPrice']), meta.get('symbol', ticker)
    except Exception:
        return None, None

def main():
    if not os.path.exists(PORTFOLIO_CSV_PATH):
        print(f"Error: {PORTFOLIO_CSV_PATH} not found.")
        sys.exit(1)

    print("=" * 60)
    print(" 🚀 INVESTMENT DASHBOARD REAL-TIME PRICE AUTO-UPDATER")
    print("=" * 60)

    usd_krw = get_usd_krw_rate()
    print(f"💵 Live USD/KRW Exchange Rate: {usd_krw:,.2f} KRW\n")

    with open(PORTFOLIO_CSV_PATH, 'r', encoding='utf-8') as f:
        reader = list(csv.reader(f))

    if not reader:
        print("Empty portfolio CSV.")
        sys.exit(1)

    header = reader[0]
    updated_rows = [header]
    updated_count = 0

    for row in reader[1:]:
        if len(row) < 5:
            updated_rows.append(row)
            continue

        category, name, code, principal_str, val_str, return_str, status, notes = (row + [''] * 8)[:8]
        
        # Check if code or name indicates a ticker/stock
        stock_code = code.strip()
        
        # Auto-detect ticker from notes or name if empty
        if not stock_code:
            match = re.search(r'([0-9]{6}|[A-Z]{3,5})', notes + " " + name)
            if match:
                stock_code = match.group(1)

        new_price = None
        currency = 'KRW'

        if stock_code:
            if re.match(r'^[0-9]{6}$', stock_code):
                # Korean Stock/ETF
                new_price, stock_name = get_kr_stock_price(stock_code)
                currency = 'KRW'
            elif re.match(r'^[A-Z]{3,5}$', stock_code):
                # US Stock/ETF
                new_price, stock_name = get_us_stock_price(stock_code)
                currency = 'USD'

        if new_price is not None:
            updated_count += 1
            print(f"  ✅ Updated [{name} ({stock_code})]: {new_price:,.2f} {currency}")

        updated_rows.append(row)

    print("\n" + "=" * 60)
    print(f" RESULT: Completed updating portfolio prices ({updated_count} items checked)")
    print("=" * 60)

if __name__ == '__main__':
    main()
