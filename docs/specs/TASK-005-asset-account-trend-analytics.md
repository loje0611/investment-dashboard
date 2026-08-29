# Specification: TASK-005 자산군 및 계좌별 시계열 추이 분석 탭 구현 (신규 UI)

## 0. Revision History
| Rev | Date | Author | Reason |
|---|---|---|---|
| 1.0 | 2026-08-29 | Lead PM Agent | 신규 자산군 및 계좌/상품별 시계열 추이 분석 탭 사양 작성 |
| 1.1 | 2026-08-29 | Lead PM Agent | 평가일 시간 정보 제거(YYYY-MM-DD) 및 개별 상품 뷰 하단 원금/평가금 성과 테이블 추가 |

---

## 1. Overview & Scope
- **목적**:
  - 기존 총자산 중심의 홈 화면을 넘어, **자산군(ETF, 연금, 현금)** 및 **개별 계좌/상품(풍차 1~12, 퇴직연금, 개인연금 등)** 단위의 시계열 평가금과 수익률 추이를 한눈에 조회하고 비교 분석할 수 있는 전용 분석 탭(`TrendAnalytics`)을 구축합니다.
- **Scope**:
  - `src/components/dashboard/TrendAnalytics.tsx` 컴포넌트 고도화.
  - 평가일 표시 포맷을 순수 `YYYY-MM-DD`로 통일 (시간 정보 `T...` 제거).
  - 개별 상품 뷰(`Product View`) 차트 하단에 원금/평가금/수익률/변동폭 성과 데이터 테이블 추가.
  - 자산군별 시계열 데이터 가공 유틸리티 (`src/utils/trendAnalytics.ts`) 보강.

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
- **평가일 포맷 규칙 (★ 중요)**:
  - 테이블 및 차트 X축/툴팁의 평가일은 ISO 시간 정보(`T15:00:00.000Z` 등)를 완전히 제거하고 반드시 `YYYY-MM-DD` (예: `2026-08-15`) 포맷으로만 출력해야 한다.
- **시계열 복합 차트**:
  - X축: 평가일 (YYYY-MM-DD 포맷)
  - 좌측 Y축: 원금 및 평가금 (스택/단독 AreaChart, 금액 단위)
  - 우측 Y축: 수익률 (LineChart, `%` 단위)
  - 인터랙티브 툴팁: 마우스 호버 시 평가일, 원금, 평가금, 수익률(%) 노출
- **월별 성과 테이블**:
  - 컬럼: `평가일` (YYYY-MM-DD), `투자원금`, `평가금액`, `전월대비 증감액(MoM)`, `수익률(%)`, `전월대비 수익률 변동(p)`
  - 증감액 및 수익률 변동은 상승 시 초록(`+`), 하락 시 빨강(`-`) 배지로 시각화.

### FR-3: 개별 상품/계좌별 수익률 및 성과 분석 (Product View)
- 상품 선택 드롭다운/버튼: `풍차1` ~ `풍차12`, `퇴직연금`, `개인연금(자문)` 등
- **수익률 시계열 차트**:
  - X축: 일자 (YYYY-MM-DD)
  - Y축: 수익률 (`%`)
  - 영역 채우기(Gradient Area) 및 기준선(0%) 가이드라인 표시
- **핵심 요약 카드**:
  - `현재 수익률`, `최고 수익률`, `최저 수익률`, `최근 6개월 변동폭`
- **개별 상품 일자별 성과 테이블 (★ 신규 추가)**:
  - 자산군별 분석 뷰와 동일한 스타일의 테이블을 차트 하단에 제공.
  - 선택된 상품의 `투자원금`(`etfList`/`pensionList`의 원금)을 조회하고, 각 평가일 수익률을 적용하여 `평가금액 = 투자원금 * (1 + 수익률/100)`을 계산하여 표시. (원금이 없는 경우 수익률 중심 표기)
  - 컬럼: `평가일` (YYYY-MM-DD), `투자원금`, `평가금액`, `전월/이전 대비 평가 증감액`, `수익률(%)`, `전월/이전 대비 수익률 변동(p)`

---

## 4. Interfaces & Data Structures
```typescript
export interface AssetClassTrendPoint {
  date: string; // YYYY-MM-DD format
  principal: number;
  valuation: number;
  returnRate: number;
  momValuationChange?: number;
  momReturnRateChange?: number;
}

export interface ProductTrendPoint {
  date: string; // YYYY-MM-DD format
  ratePercent: number;
  principal?: number;
  valuation?: number;
  momValuationChange?: number;
  momReturnRateChange?: number;
}
```

---

## 5. UI/UX Requirements
- 시각적 디자인 목업: [trend_analysis_view.jpg](file:///home/keunu/.gemini/antigravity-cli/brain/26809b3f-3ea8-4c03-ae20-3176f7225b5a/trend_analysis_view_1787998020601.jpg)의 레이아웃과 톤앤매너를 충실히 반영.
- 날짜 표기: 모든 평가일 셀 및 차트 틱에서 시간 정보 제거, `YYYY-MM-DD` 준수.
- 숫자 표기: `tabular-nums` (`tnum`) 폰트 적용으로 자릿수 정렬.
- 반응형 지원: 모바일 화면에서는 테이블 가로 스크롤 및 차트 높이 자동 최적화.

---

## 6. Non-Functional Requirements
- 성능: 탭 전환 및 자산군/상품 변경 시 렌더링 딜레이 100ms 미만 (useMemo 최적화).
- 빌드 안정성: `npx tsc --noEmit` 컴파일 에러 0건.

---

## 7. Error Handling & Edge Cases
- ISO 문자열 파싱 시 `T`로 분리하여 `date.split('T')[0]` 처리하여 유효한 YYYY-MM-DD 추출.
- 상품의 원금 데이터가 없는 경우 평가금 셀에 `-` 또는 안전한 fallback 처리.

---

## 8. Acceptance Criteria
- [ ] **AC-1**: `npm run build`가 타입 에러 없이 성공해야 한다.
- [ ] **AC-2**: 자산군별 분석 탭의 월별 성과 테이블에서 `평가일` 컬럼이 `YYYY-MM-DD` 형식(예: `2026-08-15`)으로 시간 정보 없이 깔끔하게 표시되어야 한다.
- [ ] **AC-3**: 개별 상품/계좌 분석(`Product View`) 하단에 자산군 분석과 동일하게 `평가일`, `투자원금`, `평가금액`, `수익률`, `MoM 변동`이 포함된 성과 테이블이 렌더링되어야 한다.
- [ ] **AC-4**: 상품 드롭다운 변경 시 하단 성과 테이블의 원금, 평가금, 수익률 히스토리가 선택된 상품에 맞춰 즉각 갱신되어야 한다.

---

## 9. Testing Instructions
```bash
npm run build
npx vitest run tests --environment jsdom
```

