import { useRef, useEffect, useCallback, useState } from 'react';
import { useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import Saturn from './Saturn';

/* ------------------------------------------------------------------ */
/*  CONFIG                                                             */
/* ------------------------------------------------------------------ */

const STROKE_PATH =
  'M-841 100H584c124 0 225 101 225 225v0c0 124-101 225-225 225h-95a281 281 0 00-281 281v0c0 155 125 281 281 281h442c167 0 304 136 304 304v0c0 168-137 304-304 304H795a439 439 0 00-439 439v82';
const STROKE_LENGTH = 5414.29;

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface RocketState {
  x: number;
  y: number;
  angle: number;
  progress: number;
}

/* ------------------------------------------------------------------ */
/*  DRAW ROCKET (modern / minimal)                                     */
/* ------------------------------------------------------------------ */

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(scale, scale);

  // === Subtle engine glow (replaces old trail) ===
  ctx.globalCompositeOperation = 'lighter';
  const engineGlow = ctx.createRadialGradient(-18, 0, 0, -22, 0, 18);
  engineGlow.addColorStop(0, 'rgba(100,200,255,0.35)');
  engineGlow.addColorStop(0.4, 'rgba(80,160,255,0.12)');
  engineGlow.addColorStop(1, 'rgba(60,120,255,0)');
  ctx.fillStyle = engineGlow;
  ctx.beginPath();
  ctx.ellipse(-20, 0, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // === Fins (sleek, swept-back) ===
  // Top fin
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(-18, -18);
  ctx.lineTo(-4, -6);
  ctx.closePath();
  const finGrad = ctx.createLinearGradient(-18, -18, -4, -6);
  finGrad.addColorStop(0, '#1E3A5F');
  finGrad.addColorStop(1, '#2A5F8F');
  ctx.fillStyle = finGrad;
  ctx.fill();

  // Bottom fin
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.lineTo(-18, 18);
  ctx.lineTo(-4, 6);
  ctx.closePath();
  ctx.fillStyle = finGrad;
  ctx.fill();

  // === Nozzle (minimal) ===
  ctx.beginPath();
  ctx.moveTo(-14, -4);
  ctx.lineTo(-17, -5.5);
  ctx.lineTo(-17, 5.5);
  ctx.lineTo(-14, 4);
  ctx.closePath();
  ctx.fillStyle = '#1A2A3A';
  ctx.fill();

  // Nozzle inner glow
  ctx.beginPath();
  ctx.moveTo(-14.5, -2.5);
  ctx.lineTo(-16, -3.5);
  ctx.lineTo(-16, 3.5);
  ctx.lineTo(-14.5, 2.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(100,180,255,0.3)';
  ctx.fill();

  // === Body (smooth capsule shape with gradient) ===
  ctx.beginPath();
  ctx.moveTo(-14, -7);
  ctx.lineTo(12, -7);
  ctx.quadraticCurveTo(20, -7, 24, -4);
  ctx.lineTo(24, 4);
  ctx.quadraticCurveTo(20, 7, 12, 7);
  ctx.lineTo(-14, 7);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(0, -8, 0, 8);
  bodyGrad.addColorStop(0, '#E8EDF2');
  bodyGrad.addColorStop(0.35, '#D0D8E2');
  bodyGrad.addColorStop(0.65, '#B8C4D2');
  bodyGrad.addColorStop(1, '#A0AEBE');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,120,150,0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // === Accent stripe (cyan) ===
  ctx.fillStyle = 'rgba(0,180,220,0.22)';
  ctx.fillRect(-2, -7, 2, 14);

  // === Nose cone (smooth, dark gradient) ===
  ctx.beginPath();
  ctx.moveTo(24, -5);
  ctx.quadraticCurveTo(34, -1.5, 37, 0);
  ctx.quadraticCurveTo(34, 1.5, 24, 5);
  ctx.closePath();

  const noseGrad = ctx.createLinearGradient(24, -5, 37, 0);
  noseGrad.addColorStop(0, '#2A5F8F');
  noseGrad.addColorStop(0.5, '#1E3A5F');
  noseGrad.addColorStop(1, '#0F2440');
  ctx.fillStyle = noseGrad;
  ctx.fill();

  // Nose highlight
  ctx.beginPath();
  ctx.moveTo(25, -3.5);
  ctx.quadraticCurveTo(31, -0.8, 34, 0);
  ctx.quadraticCurveTo(31, -0.3, 25, -1.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  // === Window (larger, glowing) ===
  ctx.beginPath();
  ctx.arc(8, 0, 4.2, 0, Math.PI * 2);
  const windowGrad = ctx.createRadialGradient(7, -1, 0, 8, 0, 4.2);
  windowGrad.addColorStop(0, '#7DD3FC');
  windowGrad.addColorStop(0.5, '#38BDF8');
  windowGrad.addColorStop(1, '#0284C7');
  ctx.fillStyle = windowGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,211,252,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Window glare
  ctx.beginPath();
  ctx.arc(6.5, -1.5, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // === Body highlight (top edge) ===
  ctx.beginPath();
  ctx.moveTo(-12, -6.5);
  ctx.lineTo(20, -6.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

interface RocketTrailProps {
  sectionRef: React.RefObject<HTMLElement | null>;
}

export default function RocketTrail({ sectionRef }: RocketTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgPathRef = useRef<SVGPathElement>(null);
  const rocketRef = useRef<RocketState>({ x: 0, y: 0, angle: 0, progress: 0 });
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const strokeOffset = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.85],
    [STROKE_LENGTH, (STROKE_LENGTH * 2) / 3, STROKE_LENGTH / 3, 0]
  );

  /* Convert SVG coords → canvas pixel coords */
  const svgToCanvas = useCallback((svgX: number, svgY: number): [number, number] => {
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!svg || !canvas) return [0, 0];

    const svgRect = svg.getBoundingClientRect();
    const vbX = -480, vbY = 0, vbW = 2300, vbH = 2241;
    const svgW = svgRect.width;
    const svgH = svgRect.height;

    // preserveAspectRatio="xMidYMin slice"
    const scaleX = svgW / vbW;
    const scaleY = svgH / vbH;
    const scale = Math.max(scaleX, scaleY);

    const visW = vbW * scale;
    const offsetX = (svgW - visW) / 2;
    const offsetY = 0;

    const px = offsetX + (svgX - vbX) * scale;
    const py = offsetY + (svgY - vbY) * scale;

    const dpr = window.devicePixelRatio || 1;
    return [px * dpr, py * dpr];
  }, []);

  /* Same as svgToCanvas but in CSS pixels (for positioning HTML elements) */
  const svgToCss = useCallback((svgX: number, svgY: number): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];

    const svgRect = svg.getBoundingClientRect();
    const vbX = -480, vbY = 0, vbW = 2300, vbH = 2241;
    const svgW = svgRect.width;
    const svgH = svgRect.height;

    const scaleX = svgW / vbW;
    const scaleY = svgH / vbH;
    const scale = Math.max(scaleX, scaleY);

    const visW = vbW * scale;
    const offsetX = (svgW - visW) / 2;
    const offsetY = 0;

    const px = offsetX + (svgX - vbX) * scale;
    const py = offsetY + (svgY - vbY) * scale;
    return [px, py];
  }, []);

  const [pathEnd, setPathEnd] = useState<{ x: number; y: number } | null>(null);

  /* Compute path end position for Saturn (once layout is ready) */
  useEffect(() => {
    const pathEl = svgPathRef.current;
    const svg = svgRef.current;
    if (!pathEl || !svg) return;

    const update = () => {
      try {
        const pt = pathEl.getPointAtLength(STROKE_LENGTH);
        const [x, y] = svgToCss(pt.x, pt.y);
        setPathEnd({ x, y });
      } catch {
        setPathEnd(null);
      }
    };

    const raf = requestAnimationFrame(update);
    const onResize = () => requestAnimationFrame(update);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [svgToCss]);

  /* Update rocket position from scroll */
  useMotionValueEvent(strokeOffset, 'change', (latest) => {
    const pathEl = svgPathRef.current;
    if (!pathEl) return;
    const drawn = Math.max(0, STROKE_LENGTH - latest);
    const t = Math.min(drawn, STROKE_LENGTH - 1);
    const t2 = Math.min(drawn + 24, STROKE_LENGTH);
    try {
      const pt = pathEl.getPointAtLength(t);
      const pt2 = pathEl.getPointAtLength(t2);
      const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      rocketRef.current = { x: pt.x, y: pt.y, angle, progress: drawn / STROKE_LENGTH };
    } catch {
      // ignore
    }
  });

  /* Canvas animation loop */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    let running = true;
    let pulsePhase = 0;

    const animate = (time: number) => {
      if (!running) return;
      const dt = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.05);
      lastTimeRef.current = time;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rocket = rocketRef.current;

      // Draw rocket on canvas (no trail, just the rocket + subtle halo)
      if (rocket.progress > 0.001) {
        const [rx, ry] = svgToCanvas(rocket.x, rocket.y);
        const svg = svgRef.current;
        if (svg) {
          const svgRect = svg.getBoundingClientRect();
          const scaleX = svgRect.width / 2300;
          const scaleY = svgRect.height / 2241;
          const displayScale = Math.max(scaleX, scaleY) * dpr;
          const rocketScale = displayScale * 2.1;

          // Pulsing ambient glow behind rocket
          pulsePhase += dt * 2.5;
          const pulse = 0.12 + Math.sin(pulsePhase) * 0.05;

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const haloRadius = 50 * (rocketScale / 2.1);
          const halo = ctx.createRadialGradient(rx, ry, 0, rx, ry, haloRadius);
          halo.addColorStop(0, `rgba(80,180,255,${pulse})`);
          halo.addColorStop(0.5, `rgba(60,140,220,${pulse * 0.4})`);
          halo.addColorStop(1, 'rgba(40,100,200,0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(rx, ry, haloRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';

          drawRocket(ctx, rx, ry, rocket.angle, rocketScale);
          ctx.restore();
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [svgToCanvas]);

  /* Sync initial position */
  useEffect(() => {
    const pathEl = svgPathRef.current;
    if (!pathEl) return;
    const offset = typeof strokeOffset.get === 'function' ? strokeOffset.get() : STROKE_LENGTH;
    const drawn = Math.max(0, STROKE_LENGTH - offset);
    const t = Math.min(drawn, STROKE_LENGTH - 1);
    const t2 = Math.min(drawn + 24, STROKE_LENGTH);
    try {
      const pt = pathEl.getPointAtLength(t);
      const pt2 = pathEl.getPointAtLength(t2);
      const angle = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
      rocketRef.current = { x: pt.x, y: pt.y, angle, progress: drawn / STROKE_LENGTH };
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="absolute inset-0 w-full min-h-[1200px]">
      {/* Hidden SVG for path calculations only */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
        viewBox="-480 0 2300 2241"
        style={{ minHeight: 1200, opacity: 0 }}
      >
        <path ref={svgPathRef} d={STROKE_PATH} />
      </svg>
      {/* Canvas for rocket */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ minHeight: 1200 }}
      />
      {/* Saturn at end of path */}
      {pathEnd && <Saturn left={pathEnd.x} top={pathEnd.y + 70} scale={1.15} />}
    </div>
  );
}
