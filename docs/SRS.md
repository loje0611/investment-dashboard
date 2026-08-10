# Software Requirements Specification (SRS) - Investment Dashboard (Task-Based)

## 1. 개요 (Introduction)
본 문서는 'Investment Dashboard(투자 대시보드)' 프로젝트를 처음부터 구축하기 위한 단계별(Task-Based) 소프트웨어 요구사항 명세서입니다. 
각 Task는 개별적으로 구현 및 테스트가 가능한 독립적인 단위이며, 낮은 번호의 Task는 높은 번호의 Task에 의존하지 않도록 순차적으로 구성되었습니다. AI 에이전트나 개발자는 Task 1부터 순서대로 개발을 진행하면 완벽한 제품을 만들 수 있습니다.

### 1.1 시스템 범위 (Scope)
본 시스템은 개인 투자자가 ETF, 연금, ELS, 현금성 자산을 통합 관리하고, 포트폴리오 리밸런싱을 수행하기 위한 웹 기반 대시보드입니다. 
복잡한 백엔드 서버 없이 **React/Vite 프론트엔드**와 **로컬 CSV 파일(Data Source)**만으로 동작하며, 데이터 최신화는 **Python 기반의 로컬 주가 업데이트 스크립트**를 통해 파일(CSV)을 갱신하는 방식으로 운영됩니다.

---

## 2. 시스템 아키텍처 및 기술 스택 (Architecture & Tech Stack)

### 2.1 Frontend
- **Framework/Build**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **State Management**: Zustand (전역 상태 및 데이터 스토어 관리)
- **Data Visualization**: Recharts (시계열 라인 차트, 자산 비중 파이 차트), Framer Motion (애니메이션)
- **Authentication**: `@react-oauth/google`

### 2.2 Data Source (Database)
- **Database**: 로컬 CSV 파일 (`portfolio.csv`, `history.csv` 등)
- **Data Fetching**: 서버(API) 통신 없이 애플리케이션 내부에서 로컬 CSV 파일을 직접 파싱(`localCsvApi`)하여 상태로 관리

### 2.3 Data Updating Script
- **Language**: Python (`update_prices.py`)
- **Role**: 네이버 금융 및 야후 파이낸스를 크롤링하여 **로컬 CSV 파일**의 보유 종목 최신 단가를 주기적으로 갱신

---

## 3. 데이터 모델 (Data Models & CSV Schema)

시스템은 로컬 CSV 파일을 데이터베이스로 활용하며, 파싱된 데이터 구조는 다음과 같습니다.

### 3.1 총자산 데이터 (TotalAssetRow)
- **필드**: `평가일` (YYYY-MM-DD), `연금 원금`, `연금 평가금`, `ELS 원금`, `ELS 평가금`, `ETF 원금`, `ETF 평가금`, `현금 원금`, `현금 평가금`, `총자산`, `수익률` 등
- **목적**: 대시보드의 시계열 자산 추이(Trend) 차트 렌더링에 사용

### 3.2 ETF/연금 현황 데이터 (EtfRow, PensionRow)
- **필드**: `상품명`, `투자원금`, `평가금액`, `수익률`
- **목적**: 자산 상세 탭의 테이블 구성 및 6개월 스파크라인(Sparkline) 차트 렌더링에 사용

### 3.3 ELS 데이터 (ElsRow)
- **필드**: `row_index`(식별자), `상품명`, `평가일`, `다음 평가일`, `낙인배리어`, `상환배리어`
- **목적**: 현재 ELS 상품의 리스크 프로그레스 바(Risk Progress Bar) 표시 및 관리

### 3.4 포트폴리오(리밸런싱) 데이터 (RebalancingTable)
- **구조**: 계좌별(Account Label)로 그룹핑된 테이블 형태
- **필드**: `종목명`, `수량`, `현재가`, `평가액`, `현재비중(%)`, `목표비중(%)`
- **목적**: 현재 비중과 목표 비중의 갭을 분석하여 리밸런싱 가이드 제공

---

## 4. 개발 진행 단위 (Tasks & Acceptance Criteria)

### Task 1: 프로젝트 초기 환경 세팅 및 기본 UI 레이아웃 구현
- **목표**: 프론트엔드 기본 스캐폴딩을 구성하고, 데이터를 제외한 껍데기(UI 레이아웃)를 만듭니다.
- **구현 내용**: 
  - React, TypeScript, Vite, Tailwind CSS 환경 세팅
  - 전역 상태 관리를 위한 Zustand 세팅
  - 공통 네비게이션(사이드바 혹은 헤더) 및 메인 컨텐츠 영역 레이아웃 분리
- **Acceptance Criteria (인수 조건)**:
  - [ ] `npm run dev` 실행 시 에러 없이 기본 애플리케이션이 브라우저에 렌더링되어야 한다.
  - [ ] 홈, 자산 상세, 리밸런싱 탭으로 이동할 수 있는 네비게이션 UI가 동작해야 한다.
  - [ ] 데이터가 없는 상태에서도 레이아웃이 깨지지 않아야 한다.

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
  - `TotalAssetRow`, `EtfRow`, `PensionRow`, `ElsRow` 등 CSV 스키마와 1:1 매칭되는 TypeScript 인터페이스 작성
  - CSV 문자열을 읽고 해석하여 JSON 객체 배열로 변환해 주는 로컬 유틸리티 함수(`localCsvApi`) 구현
  - 파싱된 데이터를 애플리케이션 전역 상태(Zustand)에 초기화
- **Acceptance Criteria**:
  - [ ] `portfolio.csv` 등 로컬 파일 데이터가 TypeScript 객체 배열로 에러 없이 변환되어야 한다.
  - [ ] 전역 상태(Zustand Store)를 통해 애플리케이션 내 어디서든 파싱된 데이터를 호출할 수 있어야 한다.

### Task 4: 총자산 대시보드 홈 화면 구현
- **목표**: CSV에서 추출한 데이터를 바탕으로 홈 화면에 요약 정보와 차트를 렌더링합니다. (Task 3 의존)
- **구현 내용**:
  - 상단 요약 카드(Summary Card) 컴포넌트: 총자산, ETF, 연금, ELS, 현금 등의 합계 및 수익률 표시
  - Recharts 라이브러리를 활용한 '총자산 시계열 라인 차트(Trend)' 구현
  - Recharts 라이브러리를 활용한 '자산군 비중 파이 차트(Asset Allocation)' 구현
- **Acceptance Criteria**:
  - [ ] CSV 데이터를 바탕으로 요약 카드의 금액과 수익률이 정확히 계산되어 표시되어야 한다.
  - [ ] 라인 차트에 월별(또는 일별) 자산 추이가 시각적으로 끊김 없이 그려져야 한다.
  - [ ] 파이 차트에 자산 비중이 퍼센트 단위로 정확히 분할되어 색상별로 나타나야 한다.

### Task 5: 자산 상세 탭 (ETF 및 연금) 구현
- **목표**: 포트폴리오의 ETF와 연금 상품 리스트를 상세히 보여주는 뷰를 만듭니다. (Task 3 의존)
- **구현 내용**:
  - CSV에서 가져온 ETF, 연금 데이터 배열을 테이블 형태로 렌더링하는 UI 구성
  - 개별 상품의 최근 6개월 수익률 추이를 나타내는 스파크라인(Sparkline) 미니 차트 컴포넌트 구현
- **Acceptance Criteria**:
  - [ ] 각 상품의 원금, 평가금액, 수익률이 테이블 형태의 UI에 누락 없이 출력되어야 한다.
  - [ ] 각 테이블 행마다 최근 6개월 데이터 배열을 기반으로 스파크라인 차트가 정상적으로 그려져야 한다.

### Task 6: 자산 상세 탭 (ELS 관리) 구현
- **목표**: 복잡한 조건이 있는 ELS 상품을 시각적으로 렌더링합니다. (Task 3 의존)
- **구현 내용**:
  - ELS 상품 데이터를 카드 형태로 렌더링
  - 현재 기준가, 낙인(KI) 배리어, 상환 배리어를 표시하는 `ElsRiskProgressBar` 컴포넌트 구현
  - (브라우저 상에서) ELS 신규 등록 및 상환 처리 시 Zustand 전역 상태만 갱신(가상 갱신)하는 로직 작성
- **Acceptance Criteria**:
  - [ ] ELS 카드에 현재 레벨이 상환 배리어와 낙인 배리어 중 어디에 위치하는지 프로그레스 바로 직관적으로 표시되어야 한다.
  - [ ] 상환 또는 추가 버튼 클릭 시 전역 상태(Store) 데이터가 즉각적으로 갱신되어 UI에 반영되어야 한다.

### Task 7: 포트폴리오 리밸런싱 기능 구현
- **목표**: 현재 자산 비중과 목표 비중을 비교해 매매 가이드를 제공합니다. (Task 3 의존)
- **구현 내용**:
  - 계좌별(Account Label) 리밸런싱 대상 종목 테이블 구현
  - 현재 비중(%)과 목표 비중(%)의 격차를 연산하는 로직 작성
  - 목표 달성을 위해 필요한 '매수/매도 수량 및 금액' 자동 계산 로직 구현
- **Acceptance 정Criteria**:
  - [ ] 동일 계좌 내 종목들이 그룹화되어 하나의 표(Table)로 나타나야 한다.
  - [ ] 목표 비중을 입력(또는 CSV 데이터 기준)하면 현재 평가금액 기준 매수/매도 필요 수량이 화면에 즉시 계산되어 출력되어야 한다.

### Task 8: 로컬 데이터 업데이트 스크립트 (Python) 구축
- **목표**: 외부 정보를 바탕으로 로컬 CSV 파일을 최신화하여 수동 입력의 번거로움을 줄입니다.
- **구현 내용**:
  - Python `requests`, `BeautifulSoup` 등을 사용해 네이버 금융 또는 야후 파이낸스에서 종목 최신가 조회(`update_prices.py`)
  - 조회한 최신 가격을 기존 `portfolio.csv` 등 로컬 CSV 파일에 직접 덮어쓰고 저장하는 로직 작성
- **Acceptance Criteria**:
  - [ ] `python update_prices.py` 실행 시 지정된 티커의 실시간 가격 정보를 에러 없이 스크래핑해야 한다.
  - [ ] 스크립트 실행 후 로컬 CSV 파일이 갱신되어, 프론트엔드 새로고침 시 최신 단가가 반영되어야 한다.
