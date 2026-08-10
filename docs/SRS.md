# Software Requirements Specification (SRS) - Investment Dashboard (Task-Based)

## 1. 개요 (Introduction)
본 문서는 'Investment Dashboard(투자 대시보드)' 프로젝트를 처음부터 구축하기 위한 단계별(Task-Based) 소프트웨어 요구사항 명세서입니다. 
각 Task는 개별적으로 구현 및 테스트가 가능한 독립적인 단위이며, 낮은 번호의 Task는 높은 번호의 Task에 의존하지 않도록 순차적으로 구성되었습니다. AI 에이전트나 개발자는 Task 1부터 순서대로 개발을 진행하면 완벽한 제품을 만들 수 있습니다.

### 1.1 시스템 범위 (Scope)
본 시스템은 개인 투자자가 ETF, 연금, 현금성 자산을 통합 관리하고, 포트폴리오 리밸런싱을 수행하기 위한 웹 기반 대시보드입니다. 
복잡한 백엔드 서버 없이 **React/Vite 프론트엔드**와 **로컬 CSV 파일(Data Source)**만으로 동작하며, 데이터 최신화는 **Python 기반의 로컬 주가 업데이트 스크립트**를 통해 파일(CSV)을 갱신하는 방식으로 운영됩니다.

---

## 2. 시스템 아키텍처 및 기술 스택 (Architecture & Tech Stack)

### 2.1 Frontend
- **Framework/Build**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **State Management**: Zustand (전역 상태 및 데이터 스토어 관리)
- **Data Visualization**: Recharts (시계열 스택 AreaChart, 자산 비중 파이 차트), Framer Motion (애니메이션)
- **Authentication**: `@react-oauth/google`

### 2.2 Data Source (Database)
- **Database**: 로컬 CSV 파일 (`portfolio.csv`, `history.csv`, `etf_history.csv`, `pension_history.csv` 등)
- **Data Fetching**: 서버(API) 통신 없이 애플리케이션 내부에서 로컬 CSV 파일을 직접 파싱(`localCsvApi`)하여 상태로 관리
- **상품별 수익률 이력**: Google 스프레드시트 `ETF기록`·`연금기록` 탭 내용을 각각 `etf_history.csv`, `pension_history.csv`로 복사해 스파크라인·상세 히스토리에 사용

### 2.3 Data Updating Script
- **Language**: Python (`scripts/update_prices.py`)
- **Role**: Python 표준 라이브러리(`urllib`)로 네이버 금융·야후 파이낸스 시세 API에서 최신가를 조회하여 **로컬 CSV 파일**(`src/data/portfolio.csv`)의 보유 종목 단가를 갱신

### 2.4 로컬 사용자 데이터 오버라이드 (User Overrides)
- **저장소**: 브라우저 `localStorage` (`investment_dashboard_user_overrides_v2`)
- **역할**: CSV 원본은 유지한 채, 사용자가 UI에서 수정한 **원금**·**보유 수량/단가**만 로컬에 덮어써 표시
- **적용 범위**:
  - `PrincipalEditModal`: ETF·연금 상품 원금 수정 → 수익률 재계산
  - `HoldingEditModal`: 리밸런싱 탭 보유 종목 수량·현재가 수정 → 평가금액 재계산

### 2.5 PWA (Progressive Web App)
- **Manifest**: `public/manifest.json` — 앱 이름, 아이콘, 테마 색상
- **Service Worker**: `public/sw.js` — 정적 자산 캐시 및 오프라인 재방문 지원
- **등록**: `main.tsx`에서 앱 로드 시 service worker 등록

---

## 3. 데이터 모델 (Data Models & CSV Schema)

시스템은 로컬 CSV 파일을 데이터베이스로 활용하며, 파싱된 데이터 구조는 다음과 같습니다.

### 3.1 총자산 데이터 (TotalAssetRow)
- **필드**: `평가일` (YYYY-MM-DD), `연금 원금`, `연금 평가금`, `ETF 원금`, `ETF 평가금`, `현금 원금`, `현금 평가금`, `원금 총액`, `평가금 총액`, `수익률` 등
- **목적**: 대시보드의 시계열 자산 추이(Trend) 차트 렌더링에 사용

### 3.2 ETF/연금 현황 데이터 (EtfRow, PensionRow)
- **필드**: `상품명`, `투자원금`, `평가금액`, `수익률`
- **목적**: 자산 상세 탭의 테이블 구성 및 6개월 스파크라인(Sparkline) 차트 렌더링에 사용
- **타입 구분**: CSV 파싱 결과는 `EtfSheetRow`·`PensionSheetRow`(`types/api.ts`), UI 표시용 변환 모델은 `EtfRow`·`PensionRow`(`types/dashboard.ts`)

### 3.3 포트폴리오(리밸런싱) 데이터 (RebalancingTable)
- **구조**: 계좌별(Account Label)로 그룹핑된 테이블 형태 (`portfolio.csv`의 `보유종목_*` 행)
- **필드**: `종목명`, `수량`, `현재가`, `평가액`, `현재비중(%)`, `목표비중(%)`
- **목적**: 현재 비중과 목표 비중의 갭을 분석하여 리밸런싱 가이드 제공
- **계산 규칙 (공통)**:
  - 추천 **주식 수는 항상 정수**이며, 소수가 나오면 **내림(`floor`)** 처리한다.
  - 추천 **금액 = 주식 수 × 현재가** (소수 주 단위 금액은 사용하지 않음)

---

## 4. 개발 진행 단위 (Tasks & Acceptance Criteria)

### Task 1: 프로젝트 초기 환경 세팅 및 기본 UI 레이아웃 구현
- **목표**: 프론트엔드 기본 스캐폴딩을 구성하고, 데이터를 제외한 껍데기(UI 레이아웃)를 만듭니다.
- **구현 내용**: 
  - React, TypeScript, Vite, Tailwind CSS 환경 세팅
  - 전역 상태 관리를 위한 Zustand 세팅
  - 공통 네비게이션(사이드바 혹은 헤더) 및 메인 컨텐츠 영역 레이아웃 분리
  - 금액 숨기기 토글(`AmountHideToggle`): 민감 금액 마스킹 표시 (Zustand `hideAmounts` 상태)
- **Acceptance Criteria (인수 조건)**:
  - [ ] `npm run dev` 실행 시 에러 없이 기본 애플리케이션이 브라우저에 렌더링되어야 한다.
  - [ ] 홈, 자산 상세, 리밸런싱 탭으로 이동할 수 있는 네비게이션 UI가 동작해야 한다.
  - [ ] 데이터가 없는 상태에서도 레이아웃이 깨지지 않아야 한다.
  - [ ] (로컬 개발) `.env`에 `VITE_AUTH_BYPASS=true`를 설정하면 인증 없이 대시보드 레이아웃을 검증할 수 있어야 한다. (`npm run dev` 전용, 프로덕션 빌드에서는 무시)

### Task 2: 사용자 인증 (Google OAuth) 기능 구현
- **목표**: 인가된 사용자만 대시보드에 접근할 수 있도록 인증 시스템을 구축합니다.
- **구현 내용**:
  - `@react-oauth/google` 라이브러리를 활용한 Google 로그인 페이지 구현
  - 인증 상태를 추적하는 AuthStore(Zustand) 구현 및 LocalStorage 토큰 관리 로직 작성
- **Acceptance Criteria**:
  - [ ] 미인증 사용자가 대시보드 URL 접속 시 로그인 페이지로 강제 리다이렉트되어야 한다.
  - [ ] Google 로그인 버튼을 눌러 성공적으로 인증하면 대시보드 레이아웃(Task 1)으로 진입해야 한다.
  - [ ] 인증 성공 시 이메일 정보가 LocalStorage(`investment-dashboard-auth-v1`)에 안전하게 저장되어야 한다.

### Task 3: 로컬 CSV 파싱 및 데이터 모델 기반 구축
- **목표**: 애플리케이션 내부에 위치한 로컬 CSV 파일들을 파싱하여 프론트엔드에서 사용할 수 있는 데이터 모델로 변환합니다.
- **구현 내용**:
  - `TotalAssetRow`, `EtfRow`, `PensionRow` 등 CSV 스키마와 1:1 매칭되는 TypeScript 인터페이스 작성
  - CSV 문자열을 읽고 해석하여 JSON 객체 배열로 변환해 주는 로컬 유틸리티 함수(`localCsvApi`) 구현
  - 파싱된 데이터를 애플리케이션 전역 상태(Zustand)에 초기화
- **Acceptance Criteria**:
  - [ ] `portfolio.csv` 등 로컬 파일 데이터가 TypeScript 객체 배열로 에러 없이 변환되어야 한다.
  - [ ] 전역 상태(Zustand Store)를 통해 애플리케이션 내 어디서든 파싱된 데이터를 호출할 수 있어야 한다.

### Task 4: 총자산 대시보드 홈 화면 구현
- **목표**: CSV에서 추출한 데이터를 바탕으로 홈 화면에 요약 정보와 차트를 렌더링합니다. (Task 3 의존)
- **구현 내용**:
  - 상단 요약 카드(Summary Card) 컴포넌트: 총자산, ETF, 연금, 현금성 자산의 합계 및 수익률 표시
  - Recharts 라이브러리를 활용한 '총자산 시계열 스택 AreaChart(Trend)' 구현 (원금 총액·평가금 총액)
  - Recharts 라이브러리를 활용한 '자산군 비중 파이 차트(Asset Allocation)' 구현
  - 총자산 시계열(`history.csv`) 기반 **자산 인사이트 브리핑** (`generateInsight.ts`): 전월 대비 원금·평가금 변동을 규칙 기반 문장으로 요약 (외부 AI API 미사용)
- **Acceptance Criteria**:
  - [ ] CSV 데이터를 바탕으로 요약 카드의 금액과 수익률이 정확히 계산되어 표시되어야 한다.
  - [ ] 스택 AreaChart에 월별(또는 일별) 자산 추이가 시각적으로 끊김 없이 그려져야 한다.
  - [ ] 파이 차트에 자산 비중이 퍼센트 단위로 정확히 분할되어 색상별로 나타나야 한다.
  - [ ] 전월 대비 변동 데이터가 있을 경우 홈 하단에 인사이트 브리핑 문구가 표시되어야 한다.

### Task 5: 자산 상세 탭 (ETF 및 연금) 구현
- **목표**: 포트폴리오의 ETF와 연금 상품 리스트를 상세히 보여주는 뷰를 만듭니다. (Task 3 의존)
- **구현 내용**:
  - CSV에서 가져온 ETF, 연금 데이터 배열을 **카드(Card) UI**로 렌더링 (상품명, 평가금액, 수익률 표시)
  - `etf_history.csv`·`pension_history.csv`(Google Sheets `ETF기록`·`연금기록` 탭 복사본)에서 최근 6개 평가일 수익률을 읽어 스파크라인(Sparkline) 미니 차트 컴포넌트에 연결
  - 카드 탭 시 `ProductHistoryModal`로 해당 상품의 **전체 수익률 이력** AreaChart 표시 (`localCsvApi.fetchLocalProductHistory`)
  - `PrincipalEditModal`로 상품 원금 수정 및 `localStorage` 오버라이드 저장 (§2.4)
- **Acceptance Criteria**:
  - [ ] 각 상품의 평가금액, 수익률이 카드 UI에 누락 없이 출력되어야 한다. (원금은 카드에 표시하지 않으며, 편집 모달 등에서만 관리)
  - [ ] 각 카드마다 `etf_history.csv` / `pension_history.csv`의 최근 6개월(또는 6개 평가일) 수익률 배열을 기반으로 스파크라인 차트가 정상적으로 그려져야 한다.
  - [ ] 카드 탭 시 상품별 수익률 이력 모달이 열리고, 일자별 수익률 차트가 표시되어야 한다.
  - [ ] 원금 편집 후 수익률이 재계산되어 카드에 반영되어야 하며, 새로고침 후에도 오버라이드가 유지되어야 한다.

### Task 6: 포트폴리오 리밸런싱 기능 구현
- **목표**: 현재 자산 비중과 CSV에 정의된 목표 비중을 비교해 매매 가이드를 제공합니다. (Task 3 의존)
- **구현 내용**:
  - 리밸런싱 방식 선택 UI 추가 (1. **순수 리밸런싱** / 2. **추가 매수 리밸런싱**)
  - 계좌별 종목 리스트를 테이블 방식이 아닌 **카드(Card) UI** 형태로 구현
  - 목표 비중은 사용자 입력을 받지 않고, CSV(`portfolio.csv`)에 지정된 값을 읽어서 표시
  - 계좌·모드·(추가 매수 시) 투입 금액 변경 시 **즉시** 계산 결과를 각 종목 카드에 반영 (AI 채팅 등 외부 추론 없이 규칙 기반 계산만 사용)
  - 두 가지 리밸런싱 전용 연산 유틸리티(`src/utils/rebalancingCalc.ts`) 구현:
    1. **`computePureRebalancing` (순수 리밸런싱)**  
       - 매도와 매수를 모두 포함하여 목표 비중(%)에 가깝게 조정  
       - `주식 수 = floor(|목표 평가금 − 현재 평가금| / 현재가)`, `금액 = 주식 수 × 현재가`  
       - 1주 미만 차이는 `유지(HOLD)` 처리
    2. **`computeAdditionalBuyRebalancing` (추가 매수 리밸런싱)**  
       - 입력한 추가 투입 금액(신규 현금) **이내에서만** 매수 제안 (매도 없음)  
       - 1차: 목표 비중 비례 배분 후 종목별 `floor(배분금 / 현재가)` 주 계산  
       - 2차: 남은 예수금을 **최소화**하도록 구매 가능한 종목에 1주씩 추가 매수(greedy)  
       - **추천 매수 금액 합계 ≤ 추가 투입 금액** (초과 불가)  
       - 개별 주식만 있는 계좌는 1주 단가 미만 잔액이 남을 수 있음 (이 경우 남는 금액이 최소 예수금)
  - 각 종목 카드에 매매 가이드 표시: 액션(매수/매도/유지), 추천 주식 수, 추천 금액, 반영 후 예상 비중(%)
  - `HoldingEditModal`로 보유 수량·현재가 수정 및 `localStorage` 오버라이드 저장 (§2.4)
- **Acceptance Criteria**:
  - [ ] 계좌별 종목들이 카드(Card) UI 형태로 나열되며, CSV에서 파싱된 목표 비중(%)이 카드 상에 정상 출력되어야 한다. (목표 비중 사용자 입력 기능 없음)
  - [ ] 상단에 리밸런싱 방식(순수 리밸런싱 / 추가 매수 리밸런싱)을 선택할 수 있는 UI(토글 또는 탭)가 제공되어야 한다.
  - [ ] 추천 매수/매도 **주식 수는 정수**로 표시되며, 계산 시 **내림(floor)** 규칙이 적용되어야 한다.
  - [ ] '추가 매수 리밸런싱' 모드 선택 시 추가 투입 금액 입력 폼이 제공되며, 매도 제안 없이 각 주식의 추가 매수 수량/금액만 카드에 계산·표시되어야 한다.
  - [ ] '추가 매수 리밸런싱' 모드에서 **모든 종목의 추천 매수 금액 합계가 추가 투입 금액을 초과하지 않아야** 하며, 1주 단위 제약 하에서 **잔여 예수금이 최소**가 되도록 계산되어야 한다.
  - [ ] '순수 리밸런싱' 모드 선택 시 매수 및 매도가 포함된 계산 결과(주식 수, 금액, 예상 비중)가 각 종목 카드에 명확히 표시되어야 한다.
  - [ ] 보유 수량·단가 편집 후 리밸런싱 계산 결과가 즉시 반영되어야 하며, 새로고침 후에도 오버라이드가 유지되어야 한다.

### Task 7: 로컬 데이터 업데이트 스크립트 (Python) 구축
- **목표**: 외부 정보를 바탕으로 로컬 CSV 파일을 최신화하여 수동 입력의 번거로움을 줄입니다.
- **구현 내용**:
  - Python 표준 라이브러리(`urllib`)로 네이버 금융·야후 파이낸스 시세 API에서 최신가 조회 (`scripts/update_prices.py`)
  - `portfolio.csv`의 `보유종목_*` 행에 대해 상품명(또는 미국 티커)으로 종목을 식별하고, `현재가`·`평가금액`(수량×단가)·`현재비중`을 갱신하여 `src/data/portfolio.csv`에 저장
  - 국내 ETF는 상품명→6자리 종목코드 매핑, 미국 ETF/주식은 야후 파이낸스 티커 조회 후 USD/KRW 환율로 원화 환산
- **Acceptance Criteria**:
  - [ ] `python scripts/update_prices.py` 실행 시 지정된 티커의 실시간 가격 정보를 에러 없이 조회해야 한다.
  - [ ] 스크립트 실행 후 `src/data/portfolio.csv`가 갱신되어, 프론트엔드 새로고침 시 최신 단가가 반영되어야 한다.
