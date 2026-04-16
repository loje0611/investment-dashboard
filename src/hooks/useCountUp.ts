import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration: number = 800): number {
  const [display, setDisplay] = useState(target)
  const prev = useRef(target)
  const raf = useRef(0)

  useEffect(() => {
    const from = prev.current
    const to = target
    prev.current = target

    if (from === to) return

    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        raf.current = requestAnimationFrame(animate)
      }
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return display
}
