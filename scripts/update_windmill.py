#!/usr/bin/env python3
import csv
import os
import sys
import re
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
    return f"{val:.2f}"

def format_return_rate(ret: float) -> str:
    return f"{round(ret, 2)}%"

def get_input(prompt):
    try:
        return input(prompt).strip()
    except EOFError:
        return ""

def main():
    print("=========================================")
    print("    풍차 1~12 계좌 평가금액 업데이트 도구")
    print("=========================================")
    print("* 변경이 없는 계좌는 그대로 Enter(엔터)를 누르세요.\n")

    if not os.path.exists(PORTFOLIO_CSV_PATH):
        print(f"Error: {PORTFOLIO_CSV_PATH} not found.")
        sys.exit(1)

    with open(PORTFOLIO_CSV_PATH, 'r', encoding='utf-8', newline='') as f:
        port_rows = list(csv.reader(f))

    if len(port_rows) <= 1:
        print("포트폴리오 데이터가 없습니다.")
        sys.exit(0)

    header = port_rows[0]
    col_cat = header.index('자산구분') if '자산구분' in header else 0
    col_name = header.index('상품명') if '상품명' in header else 1
    col_prin = header.index('투자원금') if '투자원금' in header else 3
    col_val = header.index('평가금액') if '평가금액' in header else 4
    col_ret = header.index('수익률') if '수익률' in header else 5

    windmill_items = []
    for i, row in enumerate(port_rows[1:], start=1):
        if len(row) <= max(col_cat, col_name, col_prin, col_val):
            continue
        name = row[col_name].strip()
        if re.match(r'^풍차\d+$', name):
            windmill_items.append((i, name, row))

    if not windmill_items:
        print("풍차 계좌 데이터를 찾을 수 없습니다.")
        sys.exit(0)

    # Sort numerically by windmill number (풍차1, 풍차2, ... 풍차12)
    windmill_items.sort(key=lambda x: int(re.search(r'\d+', x[1]).group()))

    changed = False

    for idx, name, row in windmill_items:
        prin = parse_float(row[col_prin])
        curr_val = parse_float(row[col_val])
        curr_ret = row[col_ret] if len(row) > col_ret else ""

        print(f"- [{name}] (원금: {int(prin):,}원 | 현재 평가금: {int(curr_val):,}원 | 수익률: {curr_ret})")
        user_input = get_input("  > 새로운 평가금액 입력: ")

        if user_input:
            try:
                new_val = parse_float(user_input)
                if new_val != curr_val:
                    row[col_val] = format_number(new_val)
                    if prin > 0:
                        ret = ((new_val - prin) / prin) * 100
                        if len(row) > col_ret:
                            row[col_ret] = format_return_rate(ret)
                    port_rows[idx] = row
                    changed = True
                    print(f"    ✓ 변경 완료: {int(new_val):,}원 (수익률: {row[col_ret]})\n")
            except ValueError:
                print("    ⚠️ 올바른 숫자가 아닙니다. 기존 평가금을 유지합니다.\n")
        else:
            print("    (기존 유지)\n")

    if not changed:
        print("ℹ️ 변경된 평가금액이 없습니다. 종료합니다.")
        sys.exit(0)

    # Save to portfolio.csv
    with open(PORTFOLIO_CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, lineterminator='\n')
        writer.writerows(port_rows)

    print("✅ portfolio.csv 업데이트가 완료되었습니다!")

    # Git commit & push
    print("\n[알림] 업데이트된 데이터를 Git에 반영하고 원격 저장소에 Push합니다...")
    try:
        subprocess.run(['git', 'add', 'src/data/portfolio.csv'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
        result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=os.path.dirname(SCRIPT_DIR))
        if 'src/data/portfolio.csv' in result.stdout:
            commit_msg = f"chore(data): update windmill valuations ({datetime.now().strftime('%Y-%m-%d %H:%M')})"
            subprocess.run(['git', 'commit', '-m', commit_msg], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            subprocess.run(['git', 'push'], check=True, cwd=os.path.dirname(SCRIPT_DIR))
            print("🚀 Git Push가 성공적으로 완료되었습니다!")
        else:
            print("ℹ️ 변경된 데이터가 없어 Git Push를 생략합니다.")
    except Exception as e:
        print(f"❌ Git 반영 중 오류가 발생했습니다: {e}")

if __name__ == '__main__':
    main()
