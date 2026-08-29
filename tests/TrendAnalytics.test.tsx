/** @vitest-environment jsdom */
import { cleanup, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TrendAnalytics } from '../src/components/dashboard/TrendAnalytics'

vi.mock('../src/store/useStore', async () => {
  const { create } = await import('zustand')
  const useStore = create(() => ({
    totalAssets: [
      {
        평가일: '2026-01-15T15:00:00.000Z',
        'ETF 원금': 100_000_000,
        'ETF 평가금': 110_000_000,
        '연금 원금': 50_000_000,
        '연금 평가금': 45_000_000,
        '현금 원금': 20_000_000,
        '현금 평가금': 20_000_000,
      },
      {
        평가일: '2026-02-15T10:16:30.000Z',
        'ETF 원금': 100_000_000,
        'ETF 평가금': 125_000_000,
        '연금 원금': 50_000_000,
        '연금 평가금': 52_000_000,
        '현금 원금': 25_000_000,
        '현금 평가금': 25_000_000,
      },
    ],
    etfList: [
      { 상품명: '풍차1', 투자원금: 4_000_000 },
      { 상품명: '풍차12', 투자원금: 5_000_000 },
      { 상품명: '해외투자', 투자원금: 26_000_000 },
      { 상품명: '해외투자_정은', 투자원금: 34_000_000 },
    ],
    pensionList: [
      { 상품명: '퇴직연금', 투자원금: 10_000_000 },
      { 상품명: '개인연금(자문)', 투자원금: 20_000_000 },
    ],
    isLoading: false,
  }))
  return { useStore }
})

vi.mock('../src/api/localCsvApi', () => ({
  fetchLocalProductHistory: (name: string, type: 'ETF' | 'PENSION') => {
    if (type === 'ETF' && name === '풍차1') {
      return [
        ['2025-09-01', 8],
        ['2025-10-01', 10],
        ['2025-11-01', 9],
        ['2025-12-01', 11],
        ['2026-01-01', 12],
        ['2026-02-01T09:00:00.000Z', 14],
      ]
    }
    if (type === 'ETF' && name === '풍차12') {
      return [
        ['2026-01-01', 5],
        ['2026-03-01T12:00:00.000Z', 20],
      ]
    }
    if (type === 'ETF' && name === '해외투자') {
      return [
        ['2026-02-15', 1.11],
        ['2026-03-15', 2.22],
        ['2026-04-15', 3.33],
        ['2026-05-15', 4.44],
        ['2026-06-15', 5.55],
        ['2026-07-15', 6.66],
        ['2026-08-15T10:16:30.000Z', 7.15],
      ]
    }
    if (type === 'ETF' && name === '해외투자_정은') {
      return [
        ['2026-05-15', 1.5],
        ['2026-06-15', 2.5],
        ['2026-07-15', 3.5],
        ['2026-08-15', 4.5],
      ]
    }
    if (type === 'PENSION' && name === '퇴직연금') {
      return [
        ['2025-12-01', -2],
        ['2026-01-01', 1.5],
        ['2026-02-01', 4],
      ]
    }
    return []
  },
}))

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  const React = await import('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { className: 'recharts-responsive-container', style: { width: 800, height: 360 } },
        React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<{ width?: number; height?: number }>, {
                width: 800,
                height: 360,
              })
            : child,
        ),
      ),
  }
})

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
})

describe('TASK-005 TrendAnalytics', () => {
  it('AC-2: default asset-class view shows ETF trend title, chart, and MoM table', async () => {
    render(<TrendAnalytics />)
    expect(screen.getByRole('button', { name: /자산군별 분석/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '전체 ETF' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getByText('평가일')).toBeTruthy()
    expect(within(table).getByText('투자원금')).toBeTruthy()
    expect(within(table).getByText('평가금액')).toBeTruthy()
    expect(within(table).getByText('전월대비 증감(MoM)')).toBeTruthy()
    expect(within(table).getByText('수익률(%)')).toBeTruthy()
    expect(within(table).getByText('수익률 변동(p)')).toBeTruthy()
    await waitFor(() => {
      expect(document.querySelector('.recharts-wrapper, .recharts-surface')).toBeTruthy()
    })
  })

  it('AC-3: 연금 / 현금 buttons swap chart title and table values', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: '연금' }))
    expect(screen.getByRole('heading', { name: /연금 시계열 추이/ })).toBeTruthy()
    expect(screen.getByText('45,000,000원')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '현금' }))
    expect(screen.getByRole('heading', { name: /현금 시계열 추이/ })).toBeTruthy()
    expect(screen.getAllByText('25,000,000원').length).toBeGreaterThan(0)
    expect(screen.queryByText('45,000,000원')).toBeNull()
  })

  it('AC-Visual: MoM badges use profit/loss tokens and tabular-nums', async () => {
    render(<TrendAnalytics />)
    const table = screen.getByRole('table')
    const momBadge = within(table).getByText('15,000,000').closest('span')
    expect(momBadge?.className).toMatch(/bg-emerald-500\/10/)
    expect(momBadge?.className).toMatch(/text-emerald-400/)
    const dateCell = within(table).getByText('2026-02-15')
    expect(dateCell.className).toContain('tabular-nums')
    expect(table.parentElement?.className).toMatch(/overflow-x-auto/)
  })

  it('AC-4: product view lists 풍차 accounts and shows return chart + summary cards', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))

    expect(await screen.findByText('최고 수익률')).toBeTruthy()
    expect(screen.getByText('현재 수익률')).toBeTruthy()
    expect(screen.getByText('최저 수익률')).toBeTruthy()
    expect(screen.getByText('최근 6개월 변동')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /풍차1 시계열 수익률/ })).toBeTruthy()

    const select = screen.getByRole('combobox')
    expect(within(select).getByRole('option', { name: '풍차1' })).toBeTruthy()
    expect(within(select).getByRole('option', { name: '풍차12' })).toBeTruthy()

    await waitFor(() => {
      expect(document.querySelector('.recharts-wrapper, .recharts-surface')).toBeTruthy()
    })
  })

  it('AC-4: pension products can be selected', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await screen.findByRole('combobox')
    await user.click(screen.getByRole('button', { name: '연금계좌' }))
    expect(await screen.findByRole('heading', { name: /퇴직연금 시계열 수익률/ })).toBeTruthy()
    const select = screen.getByRole('combobox')
    expect(within(select).getByRole('option', { name: '퇴직연금' })).toBeTruthy()
    expect(within(select).getByRole('option', { name: '개인연금(자문)' })).toBeTruthy()
  })

  it('FR-3: product return chart includes a 0% reference guideline', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await screen.findByRole('heading', { name: /풍차1 시계열 수익률/ })
    await waitFor(() => {
      const hit =
        document.querySelector('.recharts-reference-line') ||
        document.querySelector('.recharts-reference-line-line')
      expect(hit).toBeTruthy()
    })
  })

  it('AC-2 (rev 1.1): asset-class table dates are YYYY-MM-DD without time', () => {
    render(<TrendAnalytics />)
    const table = screen.getByRole('table')
    const dateCells = within(table).getAllByText(/^\d{4}-\d{2}-\d{2}$/)
    expect(dateCells.length).toBeGreaterThan(0)
    expect(within(table).queryByText(/T\d/)).toBeNull()
    expect(within(table).getByText('2026-02-15')).toBeTruthy()
    expect(within(table).queryByText(/2026-02-15T/)).toBeNull()
  })

  it('AC-3 (rev 1.1): product view renders a performance table with required columns', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await screen.findByRole('heading', { name: /풍차1 시계열 수익률/ })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeNull()
    })
    const table = screen.getByRole('table')
    expect(within(table).getByText('평가일')).toBeTruthy()
    expect(within(table).getByText('투자원금')).toBeTruthy()
    expect(within(table).getByText('평가금액')).toBeTruthy()
    expect(within(table).getByText('수익률(%)')).toBeTruthy()
    expect(within(table).getByText(/MoM/)).toBeTruthy()
    expect(within(table).getAllByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '4,000,000원').length).toBeGreaterThan(0)
    expect(within(table).getByText('2026-02-01')).toBeTruthy()
    expect(within(table).queryByText(/T\d/)).toBeNull()
  })

  it('AC-4 (rev 1.1): changing product dropdown updates table principal and history', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await screen.findByRole('heading', { name: /풍차1 시계열 수익률/ })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeNull()
    })
    expect(screen.getAllByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '4,000,000원').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByRole('combobox'), '풍차12')
    await screen.findByRole('heading', { name: /풍차12 시계열 수익률/ })
    expect(
      await screen.findAllByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '5,000,000원'),
    ).not.toHaveLength(0)
    expect(
      screen.queryAllByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '4,000,000원'),
    ).toHaveLength(0)
    expect(screen.getByText((_, el) => el?.tagName === 'TD' && el.textContent === '2026-03-01')).toBeTruthy()
  })

  it('AC-2 (rev 1.2): 해외투자 principal is 22M before Aug 2026 and 26M in Aug', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeNull()
    })
    await user.selectOptions(screen.getByRole('combobox'), '해외투자')
    await screen.findByRole('heading', { name: /해외투자 시계열 수익률/ })
    const table = screen.getByRole('table')

    const rowFor = (date: string) => {
      const cell = within(table).getByText((_, el) => el?.tagName === 'TD' && el.textContent === date)
      return cell.closest('tr') as HTMLTableRowElement
    }

    for (const date of ['2026-02-15', '2026-03-15', '2026-04-15', '2026-05-15', '2026-06-15', '2026-07-15']) {
      expect(within(rowFor(date)).getByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '22,000,000원')).toBeTruthy()
    }
    expect(within(rowFor('2026-08-15')).getByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '26,000,000원')).toBeTruthy()
  })

  it('AC-3 (rev 1.2): 해외투자_정은 principal is 32M before Aug 2026 and 34M in Aug', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeNull()
    })
    await user.selectOptions(screen.getByRole('combobox'), '해외투자_정은')
    await screen.findByRole('heading', { name: /해외투자_정은 시계열 수익률/ })
    const table = screen.getByRole('table')

    const rowFor = (date: string) => {
      const cell = within(table).getByText((_, el) => el?.tagName === 'TD' && el.textContent === date)
      return cell.closest('tr') as HTMLTableRowElement
    }

    for (const date of ['2026-05-15', '2026-06-15', '2026-07-15']) {
      expect(within(rowFor(date)).getByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '32,000,000원')).toBeTruthy()
    }
    expect(within(rowFor('2026-08-15')).getByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === '34,000,000원')).toBeTruthy()
  })

  it('AC-4 (rev 1.2): product table valuations are rounded integers with no decimal', async () => {
    const user = userEvent.setup()
    render(<TrendAnalytics />)
    await user.click(screen.getByRole('button', { name: /개별 상품\/계좌 분석/ }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /전체 ETF 시계열 추이/ })).toBeNull()
    })
    await user.selectOptions(screen.getByRole('combobox'), '해외투자')
    await screen.findByRole('heading', { name: /해외투자 시계열 수익률/ })
    const table = screen.getByRole('table')
    const amountCells = within(table).getAllByText((_, el) => el?.tagName === 'TD' && /원$/.test((el.textContent || '').replace(/\s/g, '')))
    expect(amountCells.length).toBeGreaterThan(0)
    for (const cell of amountCells) {
      const text = (cell.textContent || '').replace(/\s/g, '')
      expect(text).not.toMatch(/\.\d/)
      expect(text).toMatch(/^-?\d{1,3}(,\d{3})*원$/)
    }
    const augRow = within(table).getByText((_, el) => el?.tagName === 'TD' && el.textContent === '2026-08-15').closest('tr') as HTMLTableRowElement
    const expected = Math.round(26_000_000 * (1 + 7.15 / 100))
    const expectedLabel = `${expected.toLocaleString('ko-KR')}원`
    expect(within(augRow).getByText((_, el) => el?.tagName === 'TD' && (el.textContent || '').replace(/\s/g, '') === expectedLabel)).toBeTruthy()
  })
})
