import { useRef, useEffect, useCallback } from "react";
import { useIsMobile } from "../../lib/useIsMobile";

/**
 * AmbientSection — Canvas-based connected-dots network effect.
 *
 * Replaces Vanta.js NET to avoid the three.js dependency (400KB+).
 * Same visual quality, zero external deps, proper cleanup on unmount.
 *
 * Performance safeguards:
 * - Disabled entirely on mobile (renders children only)
 * - Pauses animation when scrolled offscreen (IntersectionObserver)
 * - DPR capped at 1.5 to limit GPU fill rate
 * - Particle count scales with viewport (never exceeds 80)
 *
 * To swap in real Vanta.js:
 * 1. pnpm add three vanta
 * 2. import NET from 'vanta/dist/vanta.net.min'
 * 3. Replace canvas logic with:
 *    NET({ el: containerRef.current, THREE, color: 0x00e68a, ... })
 * 4. Call effect.destroy() in useEffect cleanup
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface AmbientSectionProps {
  children: React.ReactNode;
  /** Dot/line accent color */
  color?: [number, number, number];
  /** Background base color */
  bgColor?: string;
  className?: string;
}

export default function AmbientSection({
  children,
  color = [0, 230, 138],
  bgColor = "#06060a",
  className = "",
}: AmbientSectionProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const isVisibleRef = useRef(false);

  const initNodes = useCallback(
    (w: number, h: number) => {
      const count = Math.min(Math.floor((w * h) / 18000), 80);
      const nodes: Node[] = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        });
      }
      nodesRef.current = nodes;
    },
    []
  );

  useEffect(() => {
    if (isMobile) return; // no canvas on mobile

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const connectionDistance = 150;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      w = container.clientWidth;
      h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initNodes(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    /* IntersectionObserver to pause offscreen */
    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0, rootMargin: "200px" }
    );
    obs.observe(container);

    const [r, g, b] = color;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);

      /* Skip rendering when offscreen */
      if (!isVisibleRef.current) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      const nodes = nodesRef.current;

      /* Update positions with boundary wrap */
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x = w;
        if (n.x > w) n.x = 0;
        if (n.y < 0) n.y = h;
        if (n.y > h) n.y = 0;
      }

      /* Draw connections */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * 0.12;
            ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      /* Draw nodes */
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
        ctx.fill();
      }

      /* Subtle vignette */
      const vig = ctx.createRadialGradient(
        w / 2, h / 2, w * 0.15,
        w / 2, h / 2, w * 0.6
      );
      vig.addColorStop(0, `${bgColor}00`);
      vig.addColorStop(1, `${bgColor}cc`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      obs.disconnect();
    };
  }, [isMobile, color, bgColor, initNodes]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ position: "relative" }}
    >
      {/* Canvas sits behind content, hidden on mobile */}
      {!isMobile && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content renders on top */}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
