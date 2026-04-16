import { useCallback, useEffect, useState } from 'react'

export function useHashTab<T extends string>(validTabs: readonly T[], defaultTab: T): [T, (tab: T) => void] {
  const read = useCallback((): T => {
    const h = window.location.hash.replace('#', '') as T
    return validTabs.includes(h) ? h : defaultTab
  }, [validTabs, defaultTab])

  const [tab, setTabState] = useState<T>(read)

  useEffect(() => {
    const handler = () => setTabState(read())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [read])

  const setTab = useCallback((t: T) => {
    window.location.hash = t === defaultTab ? '' : t
    setTabState(t)
  }, [defaultTab])

  return [tab, setTab]
}
