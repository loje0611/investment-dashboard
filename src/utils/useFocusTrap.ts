import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return

    const prev = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = focusables()[0]
    first?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const head = list[0]
      const tail = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === head) {
          e.preventDefault()
          tail.focus()
        }
      } else {
        if (document.activeElement === tail) {
          e.preventDefault()
          head.focus()
        }
      }
    }

    el.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('keydown', onKeyDown)
      prev?.focus()
    }
  }, [active])

  return ref
}
