#!/usr/bin/env python3
import csv
import os
import sys
from datetime import datetime
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'portfolio.csv')
HISTORY_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'history.csv')
CASH_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'cash.csv')

def parse_float(val_str):
    v = str(val_str).replace(',', '').replace('%', '').strip()
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0

def format_number(val: float) -> str:
    val = round(val, 2)
    if val.is_integer():
        return str(int(val))
    return f"{val:.2f}"

def main():
    print("=========================================")
    print("        월 스냅샷 정산 도구")
    print("=========================================")
    print("먼저 주가(update_prices.py)를 최신화한 뒤,")
    print("현재 portfolio.csv 와 cash.csv의 총합을 계산하여")
    print("history.csv에 새로운 월 정산 행을 추가합니다...\n")

    # 0. Run update_prices.py first
    print("[알림] 최신 주가를 가져옵니다 (update_prices.py 실행 중...)")
    try:
        update_prices_script = os.path.join(SCRIPT_DIR, 'update_prices.py')
        if os.path.exists(update_prices_script):
            subprocess.run([sys.executable, update_prices_script], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            print("✅ 주가 업데이트가 완료되었습니다.\n")
        else:
            print("⚠️ update_prices.py 스크립트를 찾을 수 없어 주가 갱신을 생략합니다.\n")
    except subprocess.CalledProcessError as e:
        print(f"❌ 주가 업데이트 중 오류가 발생했습니다: {e}")
        print("정산을 중단합니다.")
        sys.exit(1)

    # 1. Read portfolio.csv
    if not os.path.exists(PORTFOLIO_CSV_PATH):
        print(f"Error: {PORTFOLIO_CSV_PATH} not found.")
        sys.exit(1)
        
    with open(PORTFOLIO_CSV_PATH, 'r', encoding='utf-8') as f:
        port_rows = list(csv.reader(f))
        
    etf_prin = 0.0
    etf_val = 0.0
    pen_prin = 0.0
    pen_val = 0.0
    
    if len(port_rows) > 1:
        header = port_rows[0]
        col_cat = header.index('자산구분') if '자산구분' in header else 0
        col_name = header.index('상품명') if '상품명' in header else 1
        col_prin = header.index('투자원금') if '투자원금' in header else 3
        col_val = header.index('평가금액') if '평가금액' in header else 4
        
        for row in port_rows[1:]:
            if len(row) <= max(col_cat, col_name): continue
            cat = row[col_cat]
            name = row[col_name].strip()
            if cat.startswith('보유종목') or not name: continue
            
            p = parse_float(row[col_prin])
            v = parse_float(row[col_val])
            
            if 'ETF' in cat or '자문사' in cat:
                etf_prin += p
                etf_val += v
            elif '연금' in cat or 'IRP' in cat or 'DC' in cat:
                # 퇴직연금은 합산에서 제외
                if '퇴직연금' in name:
                    continue
                pen_prin += p
                pen_val += v

    # 2. Read cash.csv
    if not os.path.exists(CASH_CSV_PATH):
        print(f"Error: {CASH_CSV_PATH} not found.")
        sys.exit(1)
        
    with open(CASH_CSV_PATH, 'r', encoding='utf-8') as f:
        cash_rows = list(csv.reader(f))
        
    els_prin = 0.0
    els_val = 0.0
    real_cash_prin = 0.0
    real_cash_val = 0.0
    
    if len(cash_rows) > 1:
        header = cash_rows[0]
        col_name = header.index('상품명') if '상품명' in header else 0
        col_prin = header.index('투자원금') if '투자원금' in header else 1
        col_val = header.index('평가금액') if '평가금액' in header else 2
        
        for row in cash_rows[1:]:
            if len(row) <= max(col_name, col_prin, col_val): continue
            name = row[col_name].strip()
            p = parse_float(row[col_prin])
            v = parse_float(row[col_val])
            
            # ELS는 더 이상 관리하지 않으므로 무시 (항상 0)
            if 'ELS' in name.upper():
                continue
            else:
                real_cash_prin += p
                real_cash_val += v

    # 3. Calculate Totals
    total_prin = etf_prin + pen_prin + els_prin + real_cash_prin
    total_val = etf_val + pen_val + els_val + real_cash_val
    return_rate = round(((total_val - total_prin) / total_prin * 100), 2) if total_prin > 0 else 0

    # 4. Read history.csv to calculate deltas
    if not os.path.exists(HISTORY_CSV_PATH):
        print(f"Error: {HISTORY_CSV_PATH} not found.")
        sys.exit(1)
        
    with open(HISTORY_CSV_PATH, 'r', encoding='utf-8') as f:
        hist_rows = list(csv.reader(f))
        
    last_total_prin = 0.0
    last_total_val = 0.0
    if len(hist_rows) > 1:
        # 새로 추가된 잘못된 마지막 행(테스트용)은 읽지 않고 그 이전 정상 행을 찾아야 할 수도 있으나,
        # 일단 맨 마지막 행을 기준으로 봅니다. (사용자가 롤백했다면)
        last_row = hist_rows[-1]
        last_total_prin = parse_float(last_row[9]) # 원금 총액
        last_total_val = parse_float(last_row[10]) # 평가금 총액
        
    delta_prin = total_prin - last_total_prin
    delta_val = total_val - last_total_val

    # 5. Append new row to history.csv
    today_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    new_row = [
        today_str,
        format_number(pen_prin),
        format_number(pen_val),
        "0", # ELS 원금은 항상 0
        "0", # ELS 평가금은 항상 0
        format_number(etf_prin),
        format_number(etf_val),
        format_number(real_cash_prin) if real_cash_prin > 0 else "0",
        format_number(real_cash_val) if real_cash_val > 0 else "0",
        format_number(total_prin),
        format_number(total_val),
        f"{return_rate:.2f}%",
        format_number(delta_prin),
        format_number(delta_val)
    ]
    
    hist_rows.append(new_row)
    
    with open(HISTORY_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerows(hist_rows)
        
    print(f"✅ 월 정산 스냅샷이 추가되었습니다. (날짜: {today_str})")
    print(f"   - 원금 총액: {int(total_prin):,} 원 (전월대비 {int(delta_prin):+,} 원)")
    print(f"   - 평가금 총액: {int(total_val):,} 원 (전월대비 {int(delta_val):+,} 원)")
    print(f"   - 총 수익률: {return_rate:.2f}%")

    # 6. Git Push
    print("\n[알림] 정산 내역을 Git에 반영하고 원격 저장소에 Push합니다...")
    try:
        subprocess.run(['git', 'add', 'src/data/history.csv'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
        result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=os.path.dirname(SCRIPT_DIR))
        if 'src/data/history.csv' in result.stdout:
            commit_msg = f"chore(data): monthly settlement ({datetime.now().strftime('%Y-%m')})"
            subprocess.run(['git', 'commit', '-m', commit_msg], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            subprocess.run(['git', 'push'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            print("🚀 Git Push가 성공적으로 완료되었습니다!")
        else:
            print("ℹ️ 변경된 데이터가 없어 Git Push를 생략합니다.")
    except Exception as e:
        print(f"❌ Git 반영 중 오류가 발생했습니다: {e}")

if __name__ == '__main__':
    main()
