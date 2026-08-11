#!/usr/bin/env python3
import csv
import os
import sys
import subprocess
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORTFOLIO_CSV_PATH = os.path.join(SCRIPT_DIR, '..', 'src', 'data', 'portfolio.csv')

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
    return f"{val:.4f}" # 수량은 소수점 주식(해외주식 등)이 있을 수 있으므로 소수점 허용

def main():
    print("=========================================")
    print("      리밸런싱 후 보유 주수 업데이트 도구")
    print("=========================================")
    print("* 변경이 없는 종목은 그대로 Enter(엔터)를 누르세요.\n")

    if not os.path.exists(PORTFOLIO_CSV_PATH):
        print(f"Error: {PORTFOLIO_CSV_PATH} not found.")
        sys.exit(1)
        
    with open(PORTFOLIO_CSV_PATH, 'r', encoding='utf-8') as f:
        port_rows = list(csv.reader(f))
        
    if len(port_rows) <= 1:
        print("포트폴리오 데이터가 없습니다.")
        sys.exit(0)

    header = port_rows[0]
    col_cat = header.index('자산구분') if '자산구분' in header else 0
    col_name = header.index('상품명') if '상품명' in header else 1
    col_qty = header.index('수량') if '수량' in header else 8

    # 계좌별로 그룹화하여 질문하기 위해 인덱스 수집
    account_groups = {}
    for i, row in enumerate(port_rows[1:], start=1):
        if len(row) <= max(col_cat, col_name, col_qty): continue
        cat = row[col_cat].strip()
        name = row[col_name].strip()
        if cat.startswith('보유종목_') and name:
            acc_name = cat.replace('보유종목_', '')
            if acc_name not in account_groups:
                account_groups[acc_name] = []
            account_groups[acc_name].append((i, name, row[col_qty]))

    if not account_groups:
        print("보유종목(리밸런싱 대상) 데이터가 없습니다.")
        sys.exit(0)

    changed = False

    for acc_name, items in account_groups.items():
        print(f"\n[{acc_name}] 계좌 보유 종목")
        for i, name, current_qty_str in items:
            current_qty = parse_float(current_qty_str)
            display_qty = format_number(current_qty)
            
            user_input = input(f" - {name} (현재 수량: {display_qty} 주)\n > 새로운 수량 입력: ").strip()
            if user_input:
                try:
                    new_qty = float(user_input.replace(',', ''))
                    if new_qty != current_qty:
                        # 0주로 입력할 경우 완전히 처분한 것인지 파악할 수도 있지만, 일단 수량을 0으로 둡니다.
                        port_rows[i][col_qty] = format_number(new_qty)
                        changed = True
                except ValueError:
                    print(" ⚠️ 올바른 숫자가 아닙니다. 기존 수량을 유지합니다.")

    if not changed:
        print("\nℹ️ 변경된 수량이 없습니다. 스크립트를 종료합니다.")
        sys.exit(0)

    # 4. Save portfolio.csv
    with open(PORTFOLIO_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerows(port_rows)

    print("\n✅ 보유 주수 업데이트가 완료되었습니다!")

    # 5. 주가 업데이트 스크립트 연달아 실행 (평가금액을 맞추기 위해)
    print("\n[알림] 변경된 수량을 바탕으로 평가금액을 맞추기 위해 주가를 갱신합니다...")
    try:
        update_prices_script = os.path.join(SCRIPT_DIR, 'update_prices.py')
        if os.path.exists(update_prices_script):
            subprocess.run([sys.executable, update_prices_script], check=True, cwd=os.path.dirname(SCRIPT_DIR))
        else:
            print("⚠️ update_prices.py 를 찾을 수 없습니다.")
    except subprocess.CalledProcessError:
        print("❌ 주가 갱신 중 오류가 발생했습니다.")

    # 6. Git Push
    print("\n[알림] 업데이트된 수량을 Git에 반영하고 원격 저장소에 Push합니다...")
    try:
        subprocess.run(['git', 'add', 'src/data/portfolio.csv'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
        
        result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=os.path.dirname(SCRIPT_DIR))
        if 'src/data/portfolio.csv' in result.stdout:
            commit_msg = f"chore(data): update portfolio shares ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
            subprocess.run(['git', 'commit', '-m', commit_msg], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            subprocess.run(['git', 'push'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            print("🚀 Git Push가 성공적으로 완료되었습니다!")
        else:
            print("ℹ️ 변경된 데이터가 없어 Git Push를 생략합니다.")
    except Exception as e:
        print(f"❌ Git 반영 중 오류가 발생했습니다: {e}")

if __name__ == '__main__':
    main()
