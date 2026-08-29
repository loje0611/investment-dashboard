# Specification: TASK-001 UI 레이아웃 정리 및 리밸런싱/금액숨김 제거 (3개 탭 구성)

## 0. Revision History
| Rev | Date | Author | Reason |
|---|---|---|---|
| 1.0 | 2026-08-29 | Lead PM Agent | 초기 요구사항 작성 (리밸런싱 탭 제거, 금액숨김 완전 제거, 3개 탭 구성) |

---

## 1. Overview & Scope
- **목적**:
  1. 웹 UI에서 불필요해진 리밸런싱 탭(`RebalancingActionCenter`) 및 금액 숨기기 토글(`AmountHideToggle`) 관련 코드/상태를 완전히 제거하여 프론트엔드를 슬림화합니다.
  2. 메인 네비게이션을 **`[홈 (home)]`**, **`[자산 상세 (assets)]`**, **`[추이 분석 (analytics)]`** 3개 탭 구조로 재편성하고 기본 레이아웃을 정비합니다.
- **Scope**:
  - `src/components/dashboard/DashboardLayout.tsx`의 네비게이션 탭 리팩토링 (`home`, `assets`, `analytics`).
  - `src/components/dashboard/AmountHideToggle.tsx` 파일 삭제.
  - `src/store/useStore.ts`에서 `hideAmounts` 전역 상태 및 `toggleHideAmounts()` 액션 제거.
  - `GlobalOverview.tsx`, `AssetDetailsTabs.tsx` 등 하위 컴포넌트에서 `hideAmounts` prop 제거 및 마스킹 로직 정리.
  - `RebalancingActionCenter.tsx` lazy import 제거 및 추후 TASK-005를 위한 `TrendAnalytics` 탭 플레이스홀더 준비.

---

## 2. Definitions & References
- **메인 탭 식별자**:
  - `home`: 총자산 홈 대시보드
  - `assets`: 자산 상세 (ETF, 연금, 현금)
  - `analytics`: 자산군 및 계좌별 시계열 추이 분석 (신규 탭)
- **관련 파일**:
  - `src/components/dashboard/DashboardLayout.tsx`
  - `src/store/useStore.ts`
  - `src/components/dashboard/AmountHideToggle.tsx`
  - `src/components/dashboard/GlobalOverview.tsx`
  - `src/components/dashboard/AssetDetailsTabs.tsx`

---

## 3. Functional Requirements
- **FR-1**: 메인 헤더의 네비게이션 바에 `홈(LayoutDashboard)`, `자산 상세(PieChart)`, `추이 분석(TrendingUp / LineChart)` 3개 버튼이 렌더링되어야 한다.
- **FR-2**: 탭 클릭 시 URL 해시 또는 Zustand/로컬 상태(`mainTab`)가 `home`, `assets`, `analytics`로 정확히 전환되어야 한다.
- **FR-3**: `analytics` 탭 선택 시 TASK-005 컴포넌트가 완성되기 전까지 깨짐 없는 준비 화면(EmptyState 또는 '추이 분석 준비 중' 플레이스홀더)이 렌더링되어야 한다.
- **FR-4**: 금액 마스킹 기능과 관련된 모든 잔재 코드(`hideAmounts`, `AmountHideToggle` 컴포넌트 등)를 완전히 삭제하여 모든 금액이 항상 정상 표시되어야 한다.

---

## 4. Interfaces & Data Structures
- **Tab Type**:
  ```typescript
  export const VALID_TABS = ['home', 'assets', 'analytics'] as const;
  export type MainTabId = (typeof VALID_TABS)[number];
  ```
- **Store Interface (`useStore.ts`)**:
  - `hideAmounts: boolean;` 및 `toggleHideAmounts: () => void;` 제거.

---

## 5. UI/UX Requirements
- 디자인 톤앤매너: 다크 모드 기반 슬레이트/에메랄드/인디고 테마 유지.
- 상단 헤더: `Asset Flow Desktop` 타이틀 및 3개 탭 네비게이션 버튼.
- 활성 탭 하이라이트: `bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]`.

---

## 6. Non-Functional Requirements
- TypeScript 컴파일 에러가 발생하지 않아야 함 (`npx tsc --noEmit` 통과).
- Vite 개발 서버 및 빌드가 정상 통과해야 함 (`npm run build`).

---

## 7. Error Handling & Edge Cases
- 유효하지 않은 해시가 입력될 경우 기본값인 `'home'` 탭으로 폴백 처리.

---

## 8. Acceptance Criteria
- [ ] **AC-1**: `npm run build` 실행 시 TypeScript 컴파일 및 번들링 에러가 0건이어야 한다.
- [ ] **AC-2**: 상단 네비게이션에 `홈`, `자산 상세`, `추이 분석` 3개 탭이 정상 렌더링되고 클릭 시 활성 상태가 변경되어야 한다.
- [ ] **AC-3**: 화면에서 금액 숨김 버튼이 제거되고 모든 자산 수치가 정상 노출되어야 한다.
- [ ] **AC-4**: `AmountHideToggle.tsx` 파일이 삭제되어야 한다.

---

## 9. Testing Instructions
```bash
npm run build
npm run test:run # 또는 vitest 실행 (설정된 경우)
```
