/** @vitest-environment jsdom */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from '../src/components/dashboard/DashboardLayout'

vi.mock('../src/store/useStore', async () => {
  const { create } = await import('zustand')

  const useStore = create(() => ({
    etfList: [],
    pensionList: [],
    cashList: [],
    totalAssets: [],
    rebalancing: [],
    isLoading: false,
    isLoadingAssets: false,
    isLoadingRebalancing: false,
    error: null,
    fetchData: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  }))

  return { useStore }
})

vi.mock('../src/components/dashboard/GlobalOverview', () => ({
  GlobalOverview: () => <div data-testid="global-overview">home-panel</div>,
}))

vi.mock('../src/components/dashboard/AssetDetailsTabs', () => ({
  AssetDetailsTabs: () => <div data-testid="asset-details">assets-panel</div>,
}))

vi.mock('../src/components/dashboard/TrendAnalytics', () => ({
  TrendAnalytics: () => <div data-testid="trend-analytics">analytics-panel</div>,
}))

const ACTIVE_TAB_CLASSES = [
  'bg-accent',
  'text-white',
  'shadow-md',
  'shadow-accent/25',
  'scale-[1.02]',
] as const

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

function getNav() {
  return screen.getByRole('navigation')
}

describe('TASK-001 DashboardLayout', () => {
  it('AC-4: AmountHideToggle.tsx is deleted', () => {
    expect(existsSync(resolve('src/components/dashboard/AmountHideToggle.tsx'))).toBe(false)
  })

  it('AC-4 remnant: RebalancingActionCenter.tsx is deleted', () => {
    expect(existsSync(resolve('src/components/dashboard/RebalancingActionCenter.tsx'))).toBe(false)
  })

  it('renders Asset Flow Desktop title (UI/UX)', () => {
    render(<DashboardLayout />)
    expect(screen.getByRole('heading', { name: /Asset Flow/i })).toBeTruthy()
    expect(screen.getByText('Desktop')).toBeTruthy()
  })

  it('AC-2 / FR-1: nav renders 홈, 자산 상세, 추이 분석', () => {
    render(<DashboardLayout />)
    const nav = getNav()
    expect(within(nav).getByRole('button', { name: '홈' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: '자산 상세' })).toBeTruthy()
    expect(within(nav).getByRole('button', { name: '추이 분석' })).toBeTruthy()
    expect(within(nav).getAllByRole('button')).toHaveLength(3)
  })

  it('AC-3: amount-hide control is not rendered', () => {
    render(<DashboardLayout />)
    expect(screen.queryByRole('button', { name: /숨김|보이기|금액 숨/ })).toBeNull()
    expect(screen.queryByLabelText(/금액 숨/)).toBeNull()
  })

  it('home tab is active by default with specified highlight classes', () => {
    render(<DashboardLayout />)
    const home = within(getNav()).getByRole('button', { name: '홈' })
    for (const token of ACTIVE_TAB_CLASSES) {
      expect(home.className).toContain(token)
    }
    expect(screen.getByTestId('global-overview')).toBeTruthy()
  })

  it('AC-2 / FR-2: clicking 자산 상세 activates the tab and shows assets panel', async () => {
    const user = userEvent.setup()
    render(<DashboardLayout />)
    const assetsBtn = within(getNav()).getByRole('button', { name: '자산 상세' })
    await user.click(assetsBtn)
    for (const token of ACTIVE_TAB_CLASSES) {
      expect(assetsBtn.className).toContain(token)
    }
    const home = within(getNav()).getByRole('button', { name: '홈' })
    expect(home.className).not.toContain('bg-accent')
    expect(screen.getByTestId('asset-details')).toBeTruthy()
    expect(window.location.hash.replace('#', '')).toBe('assets')
  })

  it('AC-2: analytics tab loads TrendAnalytics (not a placeholder)', async () => {
    const user = userEvent.setup()
    render(<DashboardLayout />)
    await user.click(within(getNav()).getByRole('button', { name: '추이 분석' }))
    expect(screen.getByTestId('trend-analytics')).toBeTruthy()
    expect(screen.queryByText(/추이 분석 준비 중/)).toBeNull()
    expect(screen.queryByTestId('global-overview')).toBeNull()
    expect(screen.queryByTestId('asset-details')).toBeNull()
  })
})
