# Software Requirements Specification (SRS) - Investment Dashboard (Task-Based)

## 1. 개요 (Introduction)
본 문서는 'Investment Dashboard(투자 대시보드)' 프로젝트를 구축하고 고도화하기 위한 단계별(Task-Based) 소프트웨어 요구사항 명세서입니다.
각 Task는 개별적으로 구현 및 테스트가 가능한 독립적인 단위이며, 순차적으로 개발을 진행할 수 있도록 구성되었습니다.

### 1.1 시스템 아키텍처 및 계층 분리 (Architecture & Separation of Concerns)
본 시스템은 개인 투자자가 ETF, 연금, 현금성 자산을 통합 관리하기 위한 웹 대시보드와 데이터 자동화 도구로 구성되며, 다음과 같이 **완벽히 분리된 단방향 데이터 계층**을 갖습니다:

1. **데이터 표현 계층 (Web UI - React/Vite/PWA)**:
   - 로컬 CSV 파일을 읽기 전용으로 시각화하는 정적 대시보드 (No Backend).
   - `홈 (총자산 추이 & 인사이트)`, `자산 상세 (ETF & 연금 현황)`, `추이 분석 (자산군 및 계좌별 시계열 성과)` 3개 탭으로 구성.
   - 브라우저 보안 및 실시간성 한계로 인해 데이터 쓰기/수정 기능은 웹 UI에 두지 않음.
2. **데이터 관리 및 자동화 계층 (Python CLI & AI Agent Skills)**:
   - 외부 금융 API(네이버 금융, 야후 파이낸스) 시세 수집, 대화형 원금/현금/주수/풍차 수정, 월간 정산 스냅샷 생성을 담당하는 Python 스크립트 (`scripts/*.py`).
   - 실시간 시세 진단, 미국장 LOC 매매 등 복잡한 주문 가이드 발행 및 체결 추적, CSV 자동 반영은 AI 에이전트 스킬(`rebalance`, `count`, `update`, `windmill`)을 통해 엔드투엔드로 완결.

---

## 2. 시스템 아키텍처 및 기술 스택 (Tech Stack)

### 2.1 Frontend
- **Framework/Build**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer, Lucide Icons
- **State Management**: Zustand (전역 상태 및 CSV 파싱 데이터 관리)
- **Data Visualization**: Recharts (시계열 복합 차트, 파이 차트), Framer Motion (애니메이션)

### 2.2 Data Source (Database)
- **Database**: 로컬 CSV 파일 (`portfolio.csv`, `history.csv`, `cash.csv`, `etf_history.csv`, `pension_history.csv`)
- **Data Fetching**: 서버 통신 없이 애플리케이션 내부에서 로컬 CSV를 직접 파싱(`src/api/localCsvApi.ts`)

### 2.3 Data Updating Scripts (Python CLI)
- `scripts/update_prices.py`: 네이버/야후 금융 API에서 실시간 주가 및 USD/KRW 환율을 수집하여 `portfolio.csv` 단가/평가금/비중 갱신.
- `scripts/update_principal.py`: 터미널 대화형 CLI로 현금 잔액 및 상품별 원금을 입력받아 `portfolio.csv`와 `history.csv` 갱신.
- `scripts/monthly_settlement.py`: 주가 갱신 선실행 후 전체 자산 총합을 계산하여 `history.csv`에 새로운 월 정산 행 추가.
- `scripts/update_windmill.py`: 시세 조회가 불가능한 풍차 1~12 계좌의 평가금을 대화형으로 입력받아 수익률 자동 재계산 및 저장.
- `scripts/update_shares.py`: 비정기 매매/배당 재투자 시 특정 계좌 종목의 주수를 수동으로 변경하고 평가금 재계산.

### 2.4 PWA (Progressive Web App)
- **Manifest**: `public/manifest.json` — 모바일/데스크톱 홈 화면 설치 지원.
- **Service Worker**: `public/sw.js` — 정적 자산 캐시 및 오프라인 재방문 지원.

---

## 3. 데이터 모델 (Data Models & CSV Schema)

### 3.1 총자산 데이터 (TotalAssetRow)
- **필드**: `평가일` (YYYY-MM-DD), `연금 원금`, `연금 평가금`, `ETF 원금`, `ETF 평가금`, `현금 원금`, `현금 평가금`, `원금 총액`, `평가금 총액`, `원금 증감액`, `평가 증감액`, `수익률`
- **목적**: 대시보드의 시계열 자산 추이(원금/평가금) 및 수익률(%) 변화 복합 차트 렌더링에 사용.

### 3.2 ETF/연금/현금 현황 데이터 (EtfRow, PensionRow, CashRow)
- **필드**: `상품명`, `투자원금`, `평가금액`, `수익률`, `비고`
- **목적**: 자산 상세 탭의 테이블/카드 구성 및 스파크라인(Sparkline), 상세 히스토리 모달 렌더링에 사용.

### 3.3 계좌별 시계열 성과 데이터 (AccountTrendSeries)
- **구조**: 계좌명(ISA, 연금저축, 해외투자, IRP, 풍차 등) 및 자산군(ETF, 연금, 현금)별 일자, 평가금, 원금, 수익률 시계열 배열.
- **목적**: 추이 분석 탭의 시계열 복합 차트 및 월별 비교 테이블 렌더링에 사용.

---

## 4. 개발 진행 단위 (Tasks & Acceptance Criteria)

### Task 1: 프로젝트 초기 환경 세팅 및 기본 UI 레이아웃 정비
- **목표**: 프론트엔드 기본 스캐폴딩을 구성하고, 3개 탭 구조(`홈`, `자산 상세`, `추이 분석`)의 레이아웃을 완성합니다. (미사용 금액숨김 토글 제거)
- **구현 내용**:
  - React, TypeScript, Vite, Tailwind CSS 환경 세팅 및 공통 레이아웃 구성
  - 메인 네비게이션: `[홈]`, `[자산 상세]`, `[추이 분석]` 3개 탭 연동
  - 금액 숨기기(`AmountHideToggle`) 토글 및 잔재 코드/상태 제거
- **Acceptance Criteria**:
  - [ ] `npm run dev` 실행 시 에러 없이 기본 애플리케이션이 브라우저에 렌더링되어야 한다.
  - [ ] 상단 네비게이션에 `홈`, `자산 상세`, `추이 분석` 3개 탭이 정상 노출되고 탭 전환이 동작해야 한다.
  - [ ] 금액 마스킹 토글 UI가 노출되지 않으며, 모든 자산 금액이 정상 표기되어야 한다.

### Task 2: 로컬 CSV 파싱 및 통합 데이터 모델 구축
- **목표**: 로컬 CSV 파일들(`history.csv`, `portfolio.csv`, `cash.csv`, `etf_history.csv`, `pension_history.csv`)을 파싱하여 전역 상태로 제공합니다.
- **구현 내용**:
  - `TotalAssetRow`, `EtfRow`, `PensionRow`, `CashSheetRow` 등 CSV 스키마와 1:1 매칭되는 TypeScript 인터페이스 작성
  - CSV 파서 및 유틸리티(`src/api/localCsvApi.ts`) 구축
  - Zustand Store(`src/store/useStore.ts`)에 파싱 데이터 초기화
- **Acceptance Criteria**:
  - [ ] 로컬 CSV 파일 데이터가 TypeScript 객체 배열로 에러 없이 변환되어야 한다.
  - [ ] 전역 상태(Zustand)를 통해 화면 어디서든 최신 파싱 데이터를 호출할 수 있어야 한다.

### Task 3: 총자산 대시보드 홈 화면 구현
- **목표**: 총자산 요약 정보와 시계열 자산 추이 복합 차트, 자산 비중 파이 차트, 인사이트 브리핑을 렌더링합니다.
- **구현 내용**:
  - 상단 요약 카드(Summary Card): 총자산, ETF, 연금, 현금 자산의 원금/평가금/수익률 표시
  - Recharts 기반 '총자산 시계열 자산 변동 추이 및 수익률 복합 차트': 원금/평가금 스택 AreaChart(좌측 Y축) + 총 수익률 LineChart(우측 Y축)
  - Recharts 기반 '자산군 비중 파이 차트(Asset Allocation)'
  - 총자산 시계열 기반 '자산 인사이트 브리핑' (`generateInsight.ts` 규칙 기반 요약)
- **Acceptance Criteria**:
  - [ ] 요약 카드의 금액과 총 수익률이 정확히 계산되어 표시되어야 한다.
  - [ ] 복합 차트에 원금/평가금 영역과 수익률(%) 라인이 시각적으로 명확히 표시되고 툴팁이 동작해야 한다.
  - [ ] 파이 차트에 자산 비중이 퍼센트 단위로 색상별로 나타나야 한다.

### Task 4: 자산 상세 탭 (ETF, 연금, 현금) 구현
- **목표**: ETF, 연금, 현금 상품 리스트를 카드 UI로 보여주고 스파크라인 및 상세 히스토리를 제공합니다.
- **구현 내용**:
  - 상품별 카드 UI: 상품명, 평가금액, 수익률 표시
  - 6개월 스파크라인(Sparkline) 미니 차트 연결
  - 카드 클릭 시 `ProductHistoryModal`을 통해 해당 상품의 전체 수익률 이력 차트 제공
- **Acceptance Criteria**:
  - [ ] 각 상품의 평가금액과 수익률이 누락 없이 카드 UI에 표시되어야 한다.
  - [ ] 카드마다 최근 6개 평가일 수익률 기반 스파크라인이 정상 렌더링되어야 한다.
  - [ ] 카드 클릭 시 상품별 수익률 이력 모달이 열리고 시계열 차트가 노출되어야 한다.

### Task 5: 자산군 및 계좌별 시계열 추이 분석 탭 구현 (신규 UI)
- **목표**: 자산군(ETF, 연금, 현금) 및 개별 계좌(ISA, 연금저축, 해외투자, IRP, 풍차 등)의 시계열 평가금과 수익률 추이를 다각도로 분석하는 전용 탭을 구축합니다.
- **구현 내용**:
  - **자산군별 분석 뷰 (Segment 1)**: ETF / 연금 / 현금 각각의 시계열 원금, 평가금, 수익률 복합 차트 (Area + Line)
  - **계좌별 분석 뷰 (Segment 2)**: 계좌 선택 세그먼트/드롭다운 및 선택된 계좌의 월별 평가금/수익률 추이 차트
  - **월별 성과 비교 테이블**: 전월 대비 평가금 증감액(MoM), 수익률 변동률 표시 (Emerald/Rose 배지)
- **Acceptance Criteria**:
  - [ ] 자산군 및 계좌 선택 세그먼트 전환 시 해당 데이터의 시계열 차트가 즉각 반응하여 렌더링되어야 한다.
  - [ ] 월별 성과 비교 테이블에 전월 대비 증감액과 수익률 변동이 정상 표시되어야 한다.

### Task 6: 실시간 시세 및 환율 자동 업데이트 스크립트 (`update_prices.py`)
- **목표**: 네이버 금융/야후 파이낸스 API에서 실시간 주가 및 환율을 수집하여 `portfolio.csv`를 갱신합니다.
- **Acceptance Criteria**:
  - [ ] `python scripts/update_prices.py` 실행 시 지정된 국내외 종목의 실시간 가격과 환율이 에러 없이 조회되어야 한다.
  - [ ] 스크립트 실행 후 `portfolio.csv`의 현재가, 평가금액, 비중이 정상 갱신되어야 한다.

### Task 7: 투자 원금 및 현금 자산 직접 갱신 스크립트 (`update_principal.py`)
- **목표**: 터미널 대화형 CLI로 현금 자산 및 상품별 원금을 입력받아 `portfolio.csv`와 `history.csv`를 갱신합니다.
- **Acceptance Criteria**:
  - [ ] 대화형 CLI에서 항목별 변경값을 입력하면 원본 CSV 파일이 즉시 갱신되어야 한다.

### Task 8: 월 스냅샷 정산 자동화 스크립트 (`monthly_settlement.py`)
- **목표**: 시세 갱신 후 `portfolio.csv`와 `cash.csv`의 합계를 계산하여 `history.csv`에 신규 월 정산 행을 추가합니다.
- **Acceptance Criteria**:
  - [ ] `python scripts/monthly_settlement.py` 실행 시 최신 시세를 자동 갱신한 후 `history.csv`에 새로운 월 정산 행이 정상 추가되어야 한다.

### Task 9: 풍차 평가금 및 보유 주수 수동 갱신 스크립트 (`update_windmill.py`, `update_shares.py`)
- **목표**: 외부 시세 조회가 불가능한 풍차 계좌 평가금액 갱신 및 비정기 매매 시 보유 주수 수동 변경을 지원합니다.
- **Acceptance Criteria**:
  - [ ] `update_windmill.py` 실행 시 풍차 계좌 평가금 입력 후 수익률이 자동 계산되어 `portfolio.csv`에 반영되어야 한다.
  - [ ] `update_shares.py` 실행 시 특정 계좌 종목의 수량을 변경하고 평가금액이 재계산되어야 한다.
