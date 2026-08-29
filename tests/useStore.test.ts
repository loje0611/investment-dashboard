import { describe, expect, it } from 'vitest'
import { useStore } from '../src/store/useStore'

describe('useStore masking remnants (FR-4 / AC-3)', () => {
  it('does not expose hideAmounts or toggleHideAmounts', () => {
    const state = useStore.getState()
    expect(state).not.toHaveProperty('hideAmounts')
    expect(state).not.toHaveProperty('toggleHideAmounts')
  })
})
