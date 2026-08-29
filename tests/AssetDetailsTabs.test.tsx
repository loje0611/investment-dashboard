/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetDetailsTabs } from '../src/components/dashboard/AssetDetailsTabs'

describe('AssetDetailsTabs unmasked amounts (AC-3, AC-Visual)', () => {
  it('shows ₩ formatted valuation with tabular-nums', () => {
    render(
      <AssetDetailsTabs
        etfTable={[
          {
            id: 'e1',
            name: '테스트ETF',
            principal: 1000000,
            valuation: 1234567,
            returnRate: 10,
            sparklineData: [1, 2, 3],
            monthlyDeltas: [],
          },
        ]}
        pensionTable={[]}
        cashTable={[]}
      />,
    )

    const amount = screen.getByText('₩1,234,567')
    expect(amount).toBeTruthy()
    expect(amount.className).toContain('tabular-nums')
    expect(amount.textContent).not.toMatch(/#/)
  })
})
