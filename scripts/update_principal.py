#!/usr/bin/env python3
import csv
import os
import sys

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

    # 1. Update cash.csv
    if not os.path.exists(CASH_CSV_PATH):
        print(f"Error: {CASH_CSV_PATH} not found.")
        sys.exit(1)

    with open(CASH_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
        cash_rows = list(csv.reader(f))
    
    cash_sum_prin = 0.0
    cash_sum_val = 0.0

    if len(cash_rows) > 1:
        header = cash_rows[0]
        col_name = header.index('상품명') if '상품명' in header else 0
        col_prin = header.index('투자원금') if '투자원금' in header else 1
        col_val = header.index('평가금액') if '평가금액' in header else 2
        col_ret = header.index('수익률') if '수익률' in header else 3
        
        print("[1/3] 현금성 상품 원금/평가금 (CMA, 단기채, ELS)")
        for i, row in enumerate(cash_rows[1:], start=1):
            if len(row) <= max(col_name, col_prin, col_val):
                continue
            name = row[col_name]
            curr_prin = parse_float(row[col_prin])
            curr_val = parse_float(row[col_val])
            
            print(f"- {name} (현재 평가금: {int(curr_val):,} 원)")
            new_val_str = get_input("> 새로운 평가금 입력 (변경 없으면 Enter): ")
            
            if new_val_str:
                new_val = parse_float(new_val_str)
                row[col_prin] = format_number(new_val)
                row[col_val] = format_number(new_val)
                # 현금성 자산은 보통 원금=평가금 이므로 수익률 0%로 간주
                if len(row) > col_ret:
                    row[col_ret] = "0%"
                cash_rows[i] = row
            
            # 누적 합산 (결과적으로 history.csv 반영을 위해)
            cash_sum_prin += parse_float(cash_rows[i][col_prin])
            cash_sum_val += parse_float(cash_rows[i][col_val])
        print()
        
        with open(CASH_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f, lineterminator='\n')
            writer.writerows(cash_rows)

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
            if len(row) <= max(col_cat, col_name):
                continue
            cat = row[col_cat]
            name = row[col_name].strip()
            
            # 하위 보유종목이나 빈 이름은 스킵
            if cat.startswith('보유종목') or not name:
                continue
                
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

    print("\n✅ CSV 원본 업데이트가 완료되었습니다! (cash.csv, portfolio.csv)")

if __name__ == '__main__':
    main()
