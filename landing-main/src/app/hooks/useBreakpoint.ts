// src/hooks/useBreakpoint.ts
import { useEffect, useState } from "react";

type BreakpointState = { mobile: boolean; tablet: boolean };

export function useBreakpoint(): BreakpointState {
  const get = (): BreakpointState => ({
    mobile: typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
    tablet: typeof window !== "undefined" ? window.matchMedia("(max-width: 899px)").matches : false,
  });

  const [bp, setBp] = useState<BreakpointState>(get);

  useEffect(() => {
    const mmMobile = window.matchMedia("(max-width: 639px)");
    const mmTablet = window.matchMedia("(max-width: 899px)");

    const onChange = () => setBp(get());

    mmMobile.addEventListener("change", onChange);
    mmTablet.addEventListener("change", onChange);
    onChange();

    return () => {
      mmMobile.removeEventListener("change", onChange);
      mmTablet.removeEventListener("change", onChange);
    };
  }, []);

  return bp;
}
