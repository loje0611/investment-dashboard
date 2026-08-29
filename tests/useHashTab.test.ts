/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHashTab } from '../src/hooks/useHashTab'

const VALID_TABS = ['home', 'assets', 'analytics'] as const

describe('useHashTab', () => {
  it('invalid hash falls back to home', () => {
    window.location.hash = '#bogus'
    const { result } = renderHook(() => useHashTab(VALID_TABS, 'home'))
    expect(result.current[0]).toBe('home')
  })

  it('reads a valid hash tab', () => {
    window.location.hash = '#assets'
    const { result } = renderHook(() => useHashTab(VALID_TABS, 'home'))
    expect(result.current[0]).toBe('assets')
  })

  it('setTab switches to analytics and writes the hash', () => {
    window.location.hash = ''
    const { result } = renderHook(() => useHashTab(VALID_TABS, 'home'))
    act(() => {
      result.current[1]('analytics')
    })
    expect(result.current[0]).toBe('analytics')
    expect(window.location.hash.replace('#', '')).toBe('analytics')
  })

  it('setTab to home clears the hash', () => {
    window.location.hash = '#assets'
    const { result } = renderHook(() => useHashTab(VALID_TABS, 'home'))
    act(() => {
      result.current[1]('home')
    })
    expect(result.current[0]).toBe('home')
    expect(window.location.hash.replace('#', '')).toBe('')
  })
})
