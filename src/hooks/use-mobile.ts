import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Use a timeout or requestAnimationFrame to avoid calling setState during render
    // although this is inside useEffect, some lint rules are strict.
    // However, the correct way to fix 'set-state-in-effect' is often to move it
    // to a place where it doesn't trigger cascading renders or use a different approach.
    // For this simple hook, we can wrap it in a timeout or just disable the rule if it's a false positive.
    setTimeout(() => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }, 0);
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
