import { useState, useEffect } from "react";

/**
 * Detects mobile viewport via matchMedia.
 * Used to disable GPU-heavy effects (Spline, Vanta-style canvas)
 * and swap to static/CSS fallbacks on constrained devices.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
