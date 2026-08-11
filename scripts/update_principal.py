#!/usr/bin/env python3
import csv
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'portfolio.csv')
HISTORY_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'history.csv')

def parse_float(val_str):
    v = str(val_str).replace(',', '').replace('%', '').strip()
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0

def format_number(val: float) -> str:
    if val.is_integer():
        return str(int(val))
    return f"{val:.10g}"

def get_input(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""

def main():
    print("=========================================")
    print("  투자 원금 및 현금 자산 업데이트 도구")
    print("=========================================")
    print("* 변경이 없는 항목은 그대로 Enter(엔터)를 누르세요.\n")

    # 1. Update history.csv (Cash)
    if not os.path.exists(HISTORY_CSV_PATH):
        print(f"Error: {HISTORY_CSV_PATH} not found.")
        sys.exit(1)

    with open(HISTORY_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
        history_rows = list(csv.reader(f))
    
    if len(history_rows) > 1:
        header = history_rows[0]
        last_row = list(history_rows[-1])
        
        col_cash_prin = header.index('현금 원금') if '현금 원금' in header else 7
        col_cash_val = header.index('현금 평가금') if '현금 평가금' in header else 8
        col_total_prin = header.index('원금 총액') if '원금 총액' in header else 9
        col_total_val = header.index('평가금 총액') if '평가금 총액' in header else 10
        col_return = header.index('수익률') if '수익률' in header else 11
        
        current_cash = parse_float(last_row[col_cash_val])
        print("[1/3] 현금 자산")
        print(f"- 최근 현금 평가금: {int(current_cash):,} 원")
        new_cash_str = get_input("> 새로운 현금 입력: ")
        
        if new_cash_str:
            new_cash = parse_float(new_cash_str)
            old_cash_prin = parse_float(last_row[col_cash_prin])
            old_cash_val = parse_float(last_row[col_cash_val])
            
            diff_prin = new_cash - old_cash_prin
            diff_val = new_cash - old_cash_val
            
            last_row[col_cash_prin] = format_number(new_cash)
            last_row[col_cash_val] = format_number(new_cash)
            
            # Update totals
            new_total_prin = parse_float(last_row[col_total_prin]) + diff_prin
            new_total_val = parse_float(last_row[col_total_val]) + diff_val
            last_row[col_total_prin] = format_number(new_total_prin)
            last_row[col_total_val] = format_number(new_total_val)
            
            if new_total_prin > 0:
                return_rate = ((new_total_val - new_total_prin) / new_total_prin) * 100
                last_row[col_return] = f"{return_rate}%"
            
            history_rows[-1] = last_row
            
            with open(HISTORY_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f, lineterminator='\n')
                writer.writerows(history_rows)
    print()

    # 2. Update portfolio.csv (ETF and Pension)
    if not os.path.exists(PORTFOLIO_CSV_PATH):
        print(f"Error: {PORTFOLIO_CSV_PATH} not found.")
        sys.exit(1)

    with open(PORTFOLIO_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
        port_rows = list(csv.reader(f))
    
    if len(port_rows) > 1:
        header = port_rows[0]
        col_cat = header.index('자산구분') if '자산구분' in header else 0
        col_name = header.index('상품명') if '상품명' in header else 1
        col_prin = header.index('투자원금') if '투자원금' in header else 3
        col_val = header.index('평가금액') if '평가금액' in header else 4
        col_ret = header.index('수익률') if '수익률' in header else 5
        
        etfs = []
        pensions = []
        
        for i, row in enumerate(port_rows[1:], start=1):
            if len(row) <= col_cat:
                continue
            cat = row[col_cat]
            if 'ETF' in cat or '자문사' in cat:
                etfs.append((i, row))
            elif '연금' in cat or 'IRP' in cat or 'DC' in cat:
                pensions.append((i, row))
        
        print("[2/3] ETF/자문사 상품 원금")
        for i, row in etfs:
            name = row[col_name]
            curr_prin = parse_float(row[col_prin])
            print(f"- {name} (현재 원금: {int(curr_prin):,} 원)")
            new_prin_str = get_input("> 새로운 원금 입력: ")
            if new_prin_str:
                new_prin = parse_float(new_prin_str)
                row[col_prin] = format_number(new_prin)
                curr_val = parse_float(row[col_val])
                if new_prin > 0:
                    ret = ((curr_val - new_prin) / new_prin) * 100
                    row[col_ret] = f"{round(ret, 2)}%"
                port_rows[i] = row
        print()
        
        print("[3/3] 연금 상품 원금")
        for i, row in pensions:
            name = row[col_name]
            curr_prin = parse_float(row[col_prin])
            print(f"- {name} (현재 원금: {int(curr_prin):,} 원)")
            new_prin_str = get_input("> 새로운 원금 입력: ")
            if new_prin_str:
                new_prin = parse_float(new_prin_str)
                row[col_prin] = format_number(new_prin)
                curr_val = parse_float(row[col_val])
                if new_prin > 0:
                    ret = ((curr_val - new_prin) / new_prin) * 100
                    row[col_ret] = f"{round(ret, 2)}%"
                port_rows[i] = row
        print()
        
        with open(PORTFOLIO_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f, lineterminator='\n')
            writer.writerows(port_rows)

    print("✅ CSV 원본 업데이트가 완료되었습니다! (history.csv, portfolio.csv)")

if __name__ == '__main__':
    main()
