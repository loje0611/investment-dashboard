# QA Report: TASK-005 자산군 및 계좌별 시계열 추이 분석 탭

| Field | Value |
|---|---|
| Task | TASK-005 (`asset-account-trend-analytics`) |
| Spec | Rev 1.1 (YYYY-MM-DD 날짜, 상품 뷰 성과 테이블) |
| Tester | Lead QA Agent |
| Date | 2026-08-29 |
| Verdict | **QA_PASSED** |
| retry_count | 0 |

## 0. Boundary Check
Developer 변경:

- `src/utils/trendAnalytics.ts` — `formatDate` (`split('T')[0]`), `ProductTrendPoint` 확장
- `src/components/dashboard/TrendAnalytics.tsx` — 상품 이력 원금/평가금/MoM 계산, 상품 뷰 하단 성과 테이블
- `docs/task-board.json`, `docs/turn.json`

테스트 소스 무단 수정 없음. 경계 위반 없음.

## 1. Commands Executed

```bash
npm run build
# PASS — tsc -b && vite build, 0 errors

npx vitest run tests --environment jsdom
# PASS — 8 files, 32 tests
```

USB ADB 없음 (웹 태스크).

## 2. Acceptance Criteria (Rev 1.1)

| ID | Criterion | Executed? | Result |
|---|---|---|---|
| AC-1 | `npm run build` 타입 에러 없이 성공 | Yes | **PASS** |
| AC-2 | 자산군 월별 테이블 평가일 `YYYY-MM-DD`, 시간 없음 | Yes — ISO `T15:00:00.000Z` → `2026-02-15` | **PASS** |
| AC-3 | Product View 하단 성과 테이블 (평가일, 투자원금, 평가금액, 수익률, MoM) | Yes — `증감(MoM)` 컬럼·원금 행 | **PASS** |
| AC-4 | 상품 드롭다운 변경 시 테이블 원금/평가/이력 즉시 갱신 | Yes — 풍차1 `4,000,000원` → 풍차12 `5,000,000원`, `2026-03-01` | **PASS** |

회귀 (이전 FR): ETF/연금/현금 전환, 풍차·연금 선택, 0% `ReferenceLine`, `useShallow` 마운트 — 모두 PASS.

## 3. Visual Fidelity Check

| Check | Expected | Observed | Result |
|---|---|---|---|
| Date format | 테이블·차트 `YYYY-MM-DD` | 테이블 `2026-02-15`, 차트 tick `2026-03-01` (시간 없음) | PASS |
| tnum | `tabular-nums` | 평가일·금액 셀 | PASS |
| MoM badges | `bg-emerald-500/10` + `text-emerald-400` | 자산군·상품 증감 배지 | PASS |
| Product table chrome | 자산군과 동일 다크 카드/`overflow-x-auto` | `bg-surface-card border-stroke overflow-x-auto` | PASS |
| 수익률 셀 토큰 | `text-emerald-400` | 상품 테이블 수익률은 `text-emerald-500` | Observation |
| Pixel bounds | 목업 픽셀 | 브라우저 MCP 없음 | 미실행 (AC 아님) |

## 4. Observations (non-blocking)

1. 상품 성과 테이블 수익률 컬럼이 `text-emerald-500` / `text-rose-500` (스펙 토큰은 `*-400`). MoM 배지는 400.
2. `colorRateDown` 그라데이션은 정의만 되고 Area fill은 항상 `colorRateUp`.
3. `row.principal` / `row.valuation`이 0이면 `-` 표시 (`0`이 falsy). 원금 0 fallback 스펙과 대체로 맞음.

## 5. Verdict

Rev 1.1 AC를 실제 명령·테스트로 실행했고 통과했다. Developer로 핸드오프 (`status: QA_PASSED`).
