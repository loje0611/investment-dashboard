/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { GlobalOverview } from '../src/components/dashboard/GlobalOverview'
import type { SummaryCardItem } from '../src/types/dashboard'

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
})

const cards: SummaryCardItem[] = [
  { id: 'total', title: '총자산', amount: 123456789, rate: 12.3 },
  { id: 'etf', title: 'ETF', amount: 50000000, rate: 8.1 },
  { id: 'pension', title: '연금', amount: 60000000, rate: 5.2 },
  { id: 'cash', title: '현금', amount: 13456789, rate: 0 },
]

describe('GlobalOverview visual + unmasked amounts (AC-3, AC-Visual)', () => {
  it('renders numeric amounts with tabular-nums and no mask', () => {
    const { container } = render(
      <GlobalOverview
        cards={cards}
        pieData={[{ name: 'ETF', value: 50, color: '#6C8CFF' }]}
        principalValuationTrend={null}
      />,
    )

    expect(screen.getByText('123,456,789')).toBeTruthy()
    expect(screen.getByText('50,000,000')).toBeTruthy()
    expect(container.textContent).not.toMatch(/#{2,}/)

    const amountEl = screen.getByText('123,456,789')
    expect(amountEl.className).toMatch(/tabular-nums|font-black/)
  })

  it('does not accept or render a hideAmounts control', () => {
    const { container } = render(
      <GlobalOverview cards={cards} pieData={[]} principalValuationTrend={null} />,
    )
    expect(container.querySelector('[data-hide-amounts]')).toBeNull()
    expect(screen.queryByRole('button', { name: /숨김/ })).toBeNull()
  })
})
