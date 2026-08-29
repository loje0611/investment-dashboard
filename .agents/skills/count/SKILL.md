---
name: count
description: >-
  풍차 평가금 및 원금/현금 최신화 확인 후 월 정산 스냅샷을 생성하고 대시보드를 구동하는 정기 월 정산 자동화 스킬입니다.
  사용자가 '월 정산', '정산 진행', '대시보드 실행', 'count 스킬 실행' 등을 요청할 때 사용하세요.
---

# Count (월 정산 및 대시보드 실행 스킬)

이 스킬은 월말/월초 정기 정산 시점에 비정기 평가 데이터(풍차 계좌, 투자원금, 현금)를 최신화하고, `history.csv`에 새로운 월 정산 스냅샷을 기록한 후 로컬 대시보드를 구동하는 전체 파이프라인을 수행합니다.

---

## 실행 단계 (Workflow)

### Step 1: 사전 데이터 최신화 점검 (풍차 평가금 & 원금/현금)

#### 1-1. 풍차 계좌(풍차1~12) 평가금액 확인
- 풍차 계좌는 외부 시세 조회가 불가능하므로 수동 확인이 필요합니다.
- `ask_question` 도구를 사용하여 질문합니다:
  - **"이번 달 풍차 1~12 계좌의 평가금액 업데이트가 필요하신가요?"**
    - `(Recommended) 필요 없음 (이미 최신화됨 또는 건너뛰기)`
    - `풍차 평가금 업데이트 진행 (windmill 스킬 연계)`
- '풍차 평가금 업데이트 진행' 선택 시: `windmill` 스킬 워크플로우를 먼저 수행하여 `portfolio.csv`를 갱신합니다.

#### 1-2. 투자 원금 및 현금 자산 수정 확인
- `ask_question` 도구를 사용하여 질문합니다:
  - **"투자 원금이나 현금 자산의 수정이 필요하신가요?"**
    - `(Recommended) 필요 없음 (기존 데이터 유지)`
    - `원금/현금 업데이트 실행 (update_principal.py)`
- '원금/현금 업데이트 실행' 선택 시:
  - 터미널에서 `python scripts/update_principal.py`를 실행하도록 대화형으로 안내하거나 실행합니다.

---

### Step 2: 월 정산 스크립트 실행
1. 터미널에서 월 정산 스크립트를 실행합니다:
   ```bash
   python scripts/monthly_settlement.py
   ```
   *(참고: `monthly_settlement.py`는 실행 시 자동으로 `update_prices.py`를 먼저 호출하여 실시간 주가를 최신화한 후 `history.csv`에 새 스냅샷 행을 추가합니다.)*
2. 스크립트 실행 결과를 확인하고, 이번 달 총자산/평가금/수익률 요약을 사용자에게 브리핑합니다.

---

### Step 3: Git 커밋 및 푸시
정산 결과로 생성/갱신된 파일들을 Git에 저장합니다:
```bash
git add src/data/portfolio.csv src/data/history.csv src/data/cash.csv
git commit -m "chore(settlement): complete monthly settlement for $(date +'%Y-%m')"
git push
```

---

### Step 4: 로컬 대시보드 실행
1. 대시보드 로컬 개발 서버를 실행합니다:
   ```bash
   npm run dev
   ```
2. 사용자에게 "월 정산이 완료되어 최신 스냅샷이 기록되었습니다. 브라우저에서 대시보드를 확인해 주세요!"라고 안내합니다.
