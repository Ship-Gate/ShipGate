import { useEffect, useRef } from 'react';
import './StarBackground.css';

declare global {
  interface Window {
    Lenis?: new (opts?: { duration?: number; easing?: (t: number) => number; smooth?: boolean }) => {
      raf: (time: number) => void;
      on: (event: string, cb: (data: { scroll: number; velocity: number }) => void) => void;
    };
  }
}

export default function StarBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  type LenisInstance = { raf: (time: number) => void; on: (event: string, cb: (data: { scroll: number; velocity: number }) => void) => void };
  const lenisRef = useRef<LenisInstance | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const Lenis = window.Lenis;
    if (!Lenis) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }
    rafRef.current = requestAnimationFrame(raf);

    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const count = 80;
    const stars: { el: HTMLDivElement; initialY: number; speed: number }[] = [];

    for (let i = 0; i < count; i++) {
      const s = document.createElement('div');
      s.className = 'star-field-star';

      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const isStatic = Math.random() < 0.3;
      const z = isStatic ? 0 : 0.2 + Math.random() * 0.6;
      const size = isStatic ? 1 + Math.random() : 1 + Math.random() * 2;

      s.style.left = x + '%';
      s.style.top = y + '%';
      s.style.width = size + 'px';
      s.style.height = size + 'px';
      s.style.setProperty('--duration', 2 + Math.random() * 4 + 's');
      s.style.animationDelay = Math.random() * 5 + 's';

      container.appendChild(s);
      stars.push({ el: s, initialY: y, speed: z });
    }

    lenis.on('scroll', ({ scroll, velocity }) => {
      const stretch = Math.max(1, Math.min(1 + Math.abs(velocity) * 0.15, 4));

      stars.forEach((star) => {
        if (star.speed === 0) {
          star.el.style.transform = 'scaleY(1)';
          return;
        }
        let pos = (star.initialY - scroll * star.speed * 0.05) % 100;
        if (pos < 0) pos += 100;
        star.el.style.top = pos + '%';
        star.el.style.transform = `scaleY(${stretch})`;
      });
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      lenisRef.current = null;
    };
  }, []);

  return (
    <div className="star-background">
      <div ref={containerRef} id="star-container" className="star-field-container" aria-hidden />
    </div>
  );
}
