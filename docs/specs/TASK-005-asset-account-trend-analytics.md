# Specification: TASK-005 자산군 및 계좌별 시계열 추이 분석 탭 구현 (신규 UI)

## 0. Revision History
| Rev | Date | Author | Reason |
|---|---|---|---|
| 1.0 | 2026-08-29 | Lead PM Agent | 신규 자산군 및 계좌/상품별 시계열 추이 분석 탭 사양 작성 |
| 1.1 | 2026-08-29 | Lead PM Agent | 평가일 시간 정보 제거(YYYY-MM-DD) 및 개별 상품 뷰 하단 원금/평가금 성과 테이블 추가 |
| 1.2 | 2026-08-29 | Lead PM Agent | 해외투자 계좌별 과거 원금 변동 이력(2026-08 증액) 반영 및 평가금 계산 시 반올림(Math.round) 규칙 명시 |

---

## 1. Overview & Scope
- **목적**:
  - 기존 총자산 중심의 홈 화면을 넘어, **자산군(ETF, 연금, 현금)** 및 **개별 계좌/상품(풍차 1~12, 퇴직연금, 개인연금, 해외투자 등)** 단위의 시계열 평가금과 수익률 추이를 한눈에 조회하고 비교 분석할 수 있는 전용 분석 탭(`TrendAnalytics`)을 구축합니다.
- **Scope**:
  - `src/components/dashboard/TrendAnalytics.tsx` 및 `src/utils/trendAnalytics.ts` 고도화.
  - 평가일 표시 포맷을 순수 `YYYY-MM-DD`로 통일 (시간 정보 `T...` 제거).
  - 개별 상품 뷰(`Product View`) 차트 하단에 일자별 원금/평가금/수익률/변동폭 성과 데이터 테이블 구현.
  - 과거 원금 증액 이력 반영 (해외투자 2200만→2600만, 해외투자_정은 3200만→3400만) 및 평가금 반올림(`Math.round`) 적용.

---

## 2. Definitions & References
- **자산군(Asset Class)**:
  - `ETF`: `history.csv`의 `ETF 원금`, `ETF 평가금`
  - `연금 (Pension)`: `history.csv`의 `연금 원금`, `연금 평가금`
  - `현금 (Cash)`: `history.csv`의 `현금 원금`, `현금 평가금`
- **개별 상품/계좌(Product/Account Series)**:
  - `etf_history.csv` 및 `pension_history.csv`의 상품별(풍차1~12, 해외투자, 퇴직연금 등) 일자별 수익률 이력
- **계좌별 과거 원금 변동 이력 규칙 (Historical Principal Rules)**:
  - `해외투자`:
    - `2026-08-01` 이전: 투자원금 **22,000,000 원**
    - `2026-08-01` 이후: 투자원금 **26,000,000 원**
  - `해외투자_정은`:
    - `2026-08-01` 이전: 투자원금 **32,000,000 원**
    - `2026-08-01` 이후: 투자원금 **34,000,000 원**
  - 기타 상품: `portfolio.csv`에 정의된 투자원금 적용 (예: 풍차1~12 각 4,000,000원, ISA 35,000,000원 등)

---

## 3. Functional Requirements

### FR-1: 뷰 모드 전환 세그먼트 (Segmented Controls)
- 상단에 **자산군별 분석 (Asset Class View)**과 **개별 계좌/상품별 분석 (Product View)** 2가지 서브 모드를 전환할 수 있는 세그먼트 버튼을 제공한다.

### FR-2: 자산군별 시계열 분석 (Asset Class View)
- 자산군 선택 탭: `[전체 ETF]`, `[연금]`, `[현금]`
- **평가일 포맷 규칙**:
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
- 상품 선택 드롭다운/버튼: `풍차1` ~ `풍차12`, `해외투자`, `해외투자_정은`, `ISA`, `퇴직연금`, `개인연금(자문)` 등
- **수익률 시계열 차트**:
  - X축: 일자 (YYYY-MM-DD)
  - Y축: 수익률 (`%`)
  - 영역 채우기(Gradient Area) 및 기준선(0%) 가이드라인 표시
- **핵심 요약 카드**:
  - `현재 수익률`, `최고 수익률`, `최저 수익률`, `최근 6개월 변동폭`
- **개별 상품 일자별 성과 테이블**:
  - 각 평가일별로 **계좌별 과거 원금 변동 이력 규칙**을 적용하여 당시의 `투자원금`을 산출.
  - **평가금액 계산 공식 (★ 소수점 반올림 필수)**:
    $$\text{평가금액} = \text{Math.round}\left(\text{투자원금} \times \left(1 + \frac{\text{수익률}}{100}\right)\right)$$
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
- 숫자 표기: 모든 평가금액은 소수점 없는 정수 원화(원 단위)로 표기하며 `tabular-nums` (`tnum`) 폰트 적용.
- 반응형 지원: 모바일 화면에서는 테이블 가로 스크롤 및 차트 높이 자동 최적화.

---

## 6. Non-Functional Requirements
- 성능: 탭 전환 및 자산군/상품 변경 시 렌더링 딜레이 100ms 미만 (useMemo 최적화).
- 빌드 안정성: `npx tsc --noEmit` 컴파일 에러 0건.

---

## 7. Error Handling & Edge Cases
- ISO 문자열 파싱 시 `date.split('T')[0]` 처리하여 유효한 YYYY-MM-DD 추출.
- 평가금 계산 시 `Math.round`를 적용하여 부동소수점 오차 방지.

---

## 8. Acceptance Criteria
- [ ] **AC-1**: `npm run build`가 타입 에러 없이 성공해야 한다.
- [ ] **AC-2**: 개별 상품 뷰에서 `해외투자` 선택 시, 2026-02~2026-07 평가일의 투자원금이 `22,000,000원`, 2026-08 평가일은 `26,000,000원`으로 정확히 표시되어야 한다.
- [ ] **AC-3**: 개별 상품 뷰에서 `해외투자_정은` 선택 시, 2026-05~2026-07 평가일의 투자원금이 `32,000,000원`, 2026-08 평가일은 `34,000,000원`으로 정확히 표시되어야 한다.
- [ ] **AC-4**: 개별 상품 성과 테이블의 모든 평가금액이 소수점 없이 반올림된 정수 원화(`Math.round`)로 표시되어야 한다.

---

## 9. Testing Instructions
```bash
npm run build
npx vitest run tests --environment jsdom
```


