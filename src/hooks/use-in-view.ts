import { useCallback, useEffect, useRef, useState } from "react"

type UseInViewOptions = {
  rootMargin?: string
  threshold?: number | number[]
  root?: Element | null
}

export function useInView<T extends HTMLElement>(options: UseInViewOptions = {}) {
  const [inView, setInView] = useState(false)
  const { rootMargin = "0px", threshold = 0, root = null } = options
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!node) {
        setInView(false)
        return
      }
      const obs = new IntersectionObserver(
        (entries) => {
          const e = entries[0]
          if (e) setInView(e.isIntersecting)
        },
        { root, rootMargin, threshold },
      )
      observerRef.current = obs
      obs.observe(node)
    },
    [root, rootMargin, threshold],
  )

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  return { ref, inView }
}
