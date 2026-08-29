# QA Report: TASK-005 자산군 및 계좌별 시계열 추이 분석 탭

| Field | Value |
|---|---|
| Task | TASK-005 (`asset-account-trend-analytics`) |
| Spec | Rev 1.2 (해외투자 원금 이력, 평가금 Math.round) |
| Tester | Lead QA Agent |
| Date | 2026-08-29 |
| Verdict | **QA_PASSED** |
| retry_count | 0 |

## 0. Boundary Check
Developer 변경:

- `src/components/dashboard/TrendAnalytics.tsx` — 해외투자/해외투자_정은 일자별 원금 규칙, `Math.round` 평가금
- `docs/task-board.json`, `docs/turn.json`

테스트 소스 무단 수정 없음. 경계 위반 없음.

## 1. Commands Executed

```bash
npm run build
# PASS — tsc -b && vite build, 0 errors

npx vitest run tests --environment jsdom
# PASS — 8 files, 35 tests
```

USB ADB 없음 (웹 태스크).

## 2. Acceptance Criteria (Rev 1.2)

| ID | Criterion | Executed? | Result |
|---|---|---|---|
| AC-1 | `npm run build` 성공 | Yes | **PASS** |
| AC-2 | `해외투자`: 2026-02~07 원금 `22,000,000원`, 2026-08 `26,000,000원` | Yes — 행별 원금 셀 | **PASS** |
| AC-3 | `해외투자_정은`: 2026-05~07 `32,000,000원`, 2026-08 `34,000,000원` | Yes — 행별 원금 셀 | **PASS** |
| AC-4 | 상품 테이블 평가금액 정수 반올림 (`Math.round`) | Yes — 소수점 없음, 8월 `Math.round(26e6*(1+7.15/100))` 일치 | **PASS** |

Rev 1.1 회귀(YYYY-MM-DD, 상품 테이블, 드롭다운 갱신) 및 차트/0% 기준선도 PASS.

## 3. Visual Fidelity Check

| Check | Expected | Observed | Result |
|---|---|---|---|
| Date | `YYYY-MM-DD` | `2026-08-15` (ISO T 제거) | PASS |
| 원 단위 정수 | 소수점 없는 원화 | `22,000,000원` / `26,000,000원` 등 | PASS |
| tnum | `tabular-nums` | 원금·평가 셀 | PASS |
| MoM tokens | emerald-400 / rose-400 + `/10` bg | 유지 | PASS |
| Pixel bounds | 목업 픽셀 | 브라우저 MCP 없음 | 미실행 (AC 아님) |

## 4. Observations (non-blocking)

1. 과거 원금 규칙은 `TrendAnalytics.tsx`에 인라인. 유틸(`trendAnalytics.ts`)로 빼지 않음. 동작은 AC와 일치.
2. 상품 테이블 수익률 컬럼은 여전히 `text-emerald-500` (스펙 토큰은 `*-400`).
3. Area fill `colorRateDown` 미사용.

## 5. Verdict

Rev 1.2 AC를 실행했고 통과했다. Developer로 핸드오프 (`status: QA_PASSED`).
