# QA Report: TASK-001 UI 레이아웃 정리 및 리밸런싱/금액숨김 제거

| Field | Value |
|---|---|
| Task | TASK-001 (`layout-and-tab-cleanup`) |
| Tester | Lead QA Agent |
| Date | 2026-08-29 |
| Verdict | **QA_PASSED** |
| retry_count | 0 |

## 0. Boundary Check
Developer 변경 파일 (`git diff --name-only`):

- `docs/task-board.json`, `docs/turn.json` (핸드오프)
- `src/components/dashboard/AmountHideToggle.tsx` (삭제)
- `src/components/dashboard/RebalancingActionCenter.tsx` (삭제)
- `src/components/dashboard/DashboardLayout.tsx`
- `src/components/dashboard/AssetDetailsTabs.tsx`
- `src/components/dashboard/GlobalOverview.tsx`
- `src/store/useStore.ts`
- `src/utils/maskSensitiveAmount.ts`

테스트 소스 수정 없음. 경계 위반 없음.

## 1. Commands Executed

```bash
npm run build
# result: PASS (tsc -b && vite build, 0 errors)

npx vitest run tests --environment jsdom
# result: PASS — 6 files, 17 tests
```

`package.json`에 `test:run` 스크립트/vitest 의존성이 없어, 스펙 Testing Instructions의 대안(`vitest 실행`)을 실행했다. 테스트 러너 패키지는 `--no-save`로만 설치했고 `package.json` / lockfile은 변경하지 않았다.

On-Device USB QA: `adb` 미설치. 본 태스크는 웹(Vite/React) 범위이며 물리 Android 기기 검증은 해당 없음.

## 2. Acceptance Criteria

| ID | Criterion | Executed? | Result |
|---|---|---|---|
| AC-1 | `npm run build` TypeScript/번들 에러 0건 | Yes — `npm run build` | **PASS** |
| AC-2 | 상단 네비에 홈/자산 상세/추이 분석 3탭, 클릭 시 활성 상태 변경 | Yes — `tests/DashboardLayout.test.tsx` (클릭 + hash + class) | **PASS** |
| AC-3 | 금액 숨김 버튼 제거, 자산 수치 정상 노출 | Yes — 레이아웃/스토어/포맷/카드·상세 렌더 테스트 | **PASS** |
| AC-4 | `AmountHideToggle.tsx` 삭제 | Yes — `existsSync` 단언 | **PASS** |

추가 실행 (스펙 FR, AC는 아니나 검증함):

| Item | Executed? | Result |
|---|---|---|
| FR-3 analytics 플레이스홀더 `추이 분석 준비 중` | Yes | PASS |
| 유효하지 않은 해시 → `home` 폴백 | Yes — `tests/useHashTab.test.ts` | PASS |
| `hideAmounts` / `toggleHideAmounts` 스토어 제거 | Yes — `tests/useStore.test.ts` | PASS |
| `RebalancingActionCenter.tsx` 삭제 | Yes | PASS |

## 3. Visual Fidelity Check

실행 방법: jsdom + Testing Library로 렌더된 DOM의 가시성, 텍스트, 지정 클래스 토큰을 단언. 픽셀 단위 layout bounds는 jsdom에서 의미 있는 레이아웃 엔진이 없어 **미실행** (브라우저 MCP/실기기 없음). 클래스 토큰·카피·탭 하이라이트는 실행함.

| Check | Expected (spec) | Observed | Result |
|---|---|---|---|
| Header title | `Asset Flow Desktop` | heading `Asset Flow` + `Desktop` | PASS |
| Nav tabs | 홈 / 자산 상세 / 추이 분석, 3개 버튼 | `navigation` 내 버튼 3개, 라벨 일치 | PASS |
| Active tab | `bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]` | 기본 홈 및 클릭 후 자산 상세에 동일 토큰 | PASS |
| Analytics empty | 깨짐 없는 플레이스홀더 | `추이 분석 준비 중...` | PASS |
| Amount hide control | 없음 | 숨김/보이기 버튼 없음 | PASS |
| Amounts unmasked | 숫자 정상 노출 | `123,456,789`, `₩1,234,567`, `#` 마스크 없음 | PASS |
| tnum (자산 상세 평가금) | tabular figures | `tabular-nums` on `₩1,234,567` | PASS |
| tnum (홈 요약 카드 금액) | (테스터 가이드: tnum) | `text-xl font-black` only, **no `tabular-nums`** | Observation |
| Dark surface | `bg-surface-primary` / card tokens | 루트 `min-h-screen bg-surface-primary` | PASS |

## 4. Observations (non-blocking)

1. `src/utils/maskSensitiveAmount.ts`에 미사용 `AMOUNT_MASK = '#'` 상수가 남아 있다. FR-4 예시(`hideAmounts`, `AmountHideToggle`)는 제거됐고 화면 금액은 마스킹되지 않는다.
2. 스펙 §4는 `VALID_TABS` / `MainTabId` export를 요구하나, 구현은 `DashboardLayout.tsx` 내부 심볼이다. 런타임 탭 동작(AC-2, 해시 폴백)은 통과.
3. 헤더 서브카피 `스마트 자산 관리 & 리밸런싱`은 스펙 UI/UX에 없고 리밸런싱 탭 제거와 어긋날 수 있으나 AC 범위 밖.
4. 홈 요약 카드 금액에 `tabular-nums`가 없다. 자산 상세 평가금에는 있다.

## 5. Verdict

모든 선언 AC를 실제 명령/테스트로 실행했고 통과했다. Developer로 핸드오프한다 (`status: QA_PASSED`).
