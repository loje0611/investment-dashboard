# Specification: TASK-005 자산군 및 계좌별 시계열 추이 분석 탭 구현 (신규 UI)

## 0. Revision History
| Rev | Date | Author | Reason |
|---|---|---|---|
| 1.0 | 2026-08-29 | Lead PM Agent | 신규 자산군 및 계좌/상품별 시계열 추이 분석 탭 사양 작성 |

---

## 1. Overview & Scope
- **목적**:
  - 기존 총자산 중심의 홈 화면을 넘어, **자산군(ETF, 연금, 현금)** 및 **개별 계좌/상품(풍차 1~12, 퇴직연금, 개인연금 등)** 단위의 시계열 평가금과 수익률 추이를 한눈에 조회하고 비교 분석할 수 있는 전용 분석 탭(`TrendAnalytics`)을 구축합니다.
- **Scope**:
  - `src/components/dashboard/TrendAnalytics.tsx` 신규 컴포넌트 개발.
  - `src/components/dashboard/DashboardLayout.tsx`에 `analytics` 탭 연동.
  - 자산군별 시계열 데이터 가공 유틸리티 (`src/utils/trendAnalytics.ts`) 작성.
  - Recharts 기반 자산군 복합 차트(Area + Line) 및 상품별 수익률 시계열 차트 구현.
  - 월별 성과 비교 테이블(MoM 증감액, 수익률 변동 배지) 구현.

---

## 2. Definitions & References
- **자산군(Asset Class)**:
  - `ETF`: `history.csv`의 `ETF 원금`, `ETF 평가금`
  - `연금 (Pension)`: `history.csv`의 `연금 원금`, `연금 평가금`
  - `현금 (Cash)`: `history.csv`의 `현금 원금`, `현금 평가금`
- **개별 상품/계좌(Product/Account Series)**:
  - `etf_history.csv` 및 `pension_history.csv`의 상품별(풍차1~12, 퇴직연금 등) 일자별 수익률 이력
- **디자인 토큰**:
  - 다크모드 배경: `bg-surface-primary`, `bg-surface-card`
  - 액센트 컬러: `text-accent`, `border-stroke`
  - 상승/수익 지표: `text-emerald-400`, `bg-emerald-500/10`
  - 하락/손실 지표: `text-rose-400`, `bg-rose-500/10`

---

## 3. Functional Requirements

### FR-1: 뷰 모드 전환 세그먼트 (Segmented Controls)
- 상단에 **자산군별 분석 (Asset Class View)**과 **개별 계좌/상품별 분석 (Product View)** 2가지 서브 모드를 전환할 수 있는 세그먼트 버튼을 제공한다.

### FR-2: 자산군별 시계열 분석 (Asset Class View)
- 자산군 선택 탭: `[전체 ETF]`, `[연금]`, `[현금]`
- **시계열 복합 차트**:
  - X축: 평가일 (YYYY-MM-DD 또는 YYYY.MM 포맷)
  - 좌측 Y축: 원금 및 평가금 (스택/단독 AreaChart, 금액 단위)
  - 우측 Y축: 수익률 (LineChart, `%` 단위)
  - 인터랙티브 툴팁: 마우스 호버 시 평가일, 원금, 평가금, 수익률(%) 노출
- **월별 성과 테이블**:
  - 컬럼: `평가일`, `투자원금`, `평가금액`, `전월대비 증감액(MoM)`, `수익률(%)`, `전월대비 수익률 변동(p)`
  - 증감액 및 수익률 변동은 상승 시 초록(`+`), 하락 시 빨강(`-`) 배지로 시각화.

### FR-3: 개별 상품/계좌별 수익률 분석 (Product View)
- 상품 선택 드롭다운/버튼: `풍차1` ~ `풍차12`, `퇴직연금`, `개인연금(자문)` 등
- **수익률 시계열 차트**:
  - X축: 일자 (YYYY-MM-DD)
  - Y축: 수익률 (`%`)
  - 영역 채우기(Gradient Area) 및 기준선(0%) 가이드라인 표시
- **핵심 요약 카드**:
  - `현재 수익률`, `기간 내 최고 수익률`, `기간 내 최저 수익률`, `최근 6개월 변동폭`

---

## 4. Interfaces & Data Structures
```typescript
export interface AssetClassTrendPoint {
  date: string;
  principal: number;
  valuation: number;
  returnRate: number;
  momValuationChange?: number;
  momReturnRateChange?: number;
}

export interface ProductTrendPoint {
  date: string;
  ratePercent: number;
}
```

---

## 5. UI/UX Requirements
- 시각적 디자인 목업: [trend_analysis_view.jpg](file:///home/keunu/.gemini/antigravity-cli/brain/26809b3f-3ea8-4c03-ae20-3176f7225b5a/trend_analysis_view_1787998020601.jpg)의 레이아웃과 톤앤매너를 충실히 반영.
- 숫자 표기: `tabular-nums` (`tnum`) 폰트 적용으로 자릿수 정렬.
- 반응형 지원: 모바일 화면에서는 테이블 가로 스크롤 및 차트 높이 자동 최적화.

---

## 6. Non-Functional Requirements
- 성능: 탭 전환 및 자산군/상품 변경 시 렌더링 딜레이 100ms 미만 (useMemo 최적화).
- 빌드 안정성: `npx tsc --noEmit` 컴파일 에러 0건.

---

## 7. Error Handling & Edge Cases
- 데이터가 비어있거나 원금이 0인 경우 수익률 계산 시 `0%`로 안전하게 폴백.
- 과거 데이터 중 특정 자산군 평가금이 없는 행은 건너뛰거나 안전하게 0으로 처리.

---

## 8. Acceptance Criteria
- [ ] **AC-1**: `npm run build`가 타입 에러 없이 성공해야 한다.
- [ ] **AC-2**: 상단 '추이 분석' 탭 클릭 시 `TrendAnalytics` 컴포넌트가 로드되고 기본 자산군(ETF) 시계열 차트가 렌더링되어야 한다.
- [ ] **AC-3**: `[ETF]`, `[연금]`, `[현금]` 버튼 클릭 시 해당 자산군의 시계열 원금/평가금/수익률 차트와 월별 테이블 데이터가 즉각 변경되어야 한다.
- [ ] **AC-4**: 상품별 분석 모드로 전환 시 풍차 계좌 및 연금 상품을 선택하여 일자별 수익률 차트를 확인할 수 있어야 한다.
- [ ] **AC-Visual**: 생성된 UI 목업과 일치하는 세련된 다크모드 차트와 MoM 증감 배지 테이블이 렌더링되어야 한다.

---

## 9. Testing Instructions
```bash
npm run build
npm run test:run # (테스트 구성 시)
```
