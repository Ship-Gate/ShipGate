/**
 * Motion orchestrator: GSAP + Lenis integration.
 * Respects prefers-reduced-motion for accessibility.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

type LenisInstance = {
  raf: (time: number) => void;
  on: (event: string, cb: (data: { scroll: number; velocity: number }) => void) => void;
};

let lenisInstance: LenisInstance | null = null;
let rafId: number | null = null;

function getLenisConstructor(): (new (opts?: object) => LenisInstance) | null {
  if (typeof window === 'undefined') return null;
  const Lenis = (window as Window & { Lenis?: new (opts?: object) => LenisInstance }).Lenis;
  return Lenis ?? null;
}

export function initLenis(): LenisInstance | null {
  if (prefersReducedMotion()) return null;
  if (lenisInstance) return lenisInstance;

  const Lenis = getLenisConstructor();
  if (!Lenis) return null;

  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
  });

  function raf(time: number) {
    lenisInstance?.raf(time);
    rafId = requestAnimationFrame(raf);
  }
  rafId = requestAnimationFrame(raf);

  return lenisInstance;
}

export function destroyLenis(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lenisInstance = null;
}

export function getLenis(): LenisInstance | null {
  return lenisInstance;
}

export function gsapReveal(
  elements: string | Element | Element[],
  opts?: { y?: number; duration?: number; stagger?: number; delay?: number }
): gsap.core.Tween | gsap.core.Timeline | null {
  if (prefersReducedMotion()) return null;

  const { y = 24, duration = 0.5, stagger = 0.08, delay = 0 } = opts ?? {};

  return gsap.fromTo(
    elements,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration,
      stagger: Array.isArray(elements) || typeof elements === 'string' ? stagger : 0,
      delay,
      ease: 'power3.out',
    }
  );
}

export function gsapScrollReveal(
  element: Element,
  opts?: { y?: number; duration?: number }
): ScrollTrigger | null {
  if (prefersReducedMotion()) return null;

  const { y = 30, duration = 0.5 } = opts ?? {};

  return ScrollTrigger.create({
    trigger: element,
    start: 'top 85%',
    onEnter: () => {
      gsap.fromTo(
        element,
        { opacity: 0, y },
        { opacity: 1, y: 0, duration, ease: 'power3.out' }
      );
    },
    once: true,
  });
}

export function gsapStaggerReveal(
  container: Element,
  childSelector: string,
  opts?: { y?: number; duration?: number; stagger?: number }
): ScrollTrigger | null {
  if (prefersReducedMotion()) return null;

  const { y = 20, duration = 0.4, stagger = 0.1 } = opts ?? {};

  const children = container.querySelectorAll(childSelector);
  if (children.length === 0) return null;

  return ScrollTrigger.create({
    trigger: container,
    start: 'top 85%',
    onEnter: () => {
      gsap.fromTo(
        children,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          stagger,
          ease: 'power3.out',
        }
      );
    },
    once: true,
  });
}

export { gsap, ScrollTrigger };
