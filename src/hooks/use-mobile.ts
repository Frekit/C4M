import * as React from "react"

const MOBILE_BREAKPOINT = 761

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    const timer = window.setTimeout(onChange, 0)
    return () => {
      mql.removeEventListener("change", onChange)
      window.clearTimeout(timer)
    }
  }, [])

  return !!isMobile
}
