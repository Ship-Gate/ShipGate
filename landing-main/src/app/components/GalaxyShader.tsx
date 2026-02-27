import { useRef, useEffect, useCallback } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: [number, number, number];
}

interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: [number, number, number];
  opacity: number;
  drift: number;
  phase: number;
}

export default function GalaxyShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const initRef = useRef(false);

  const init = useCallback((w: number, h: number) => {
    const count = Math.min(Math.floor((w * h) / 800), 1200);
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      const z = Math.random();
      const colorChoice = Math.random();
      let color: [number, number, number];
      if (colorChoice < 0.15) color = [120, 220, 255]; // cyan tint
      else if (colorChoice < 0.25) color = [180, 160, 255]; // purple tint
      else if (colorChoice < 0.35) color = [0, 230, 138]; // green tint (brand)
      else color = [255, 255, 255];

      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        size: 0.3 + z * 2.2,
        brightness: 0.2 + z * 0.8,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
        color,
      });
    }
    starsRef.current = stars;

    const nebulae: Nebula[] = [
      { x: w * 0.3, y: h * 0.25, radius: w * 0.35, color: [0, 200, 255], opacity: 0.025, drift: 0.15, phase: 0 },
      { x: w * 0.7, y: h * 0.6, radius: w * 0.3, color: [120, 80, 255], opacity: 0.02, drift: 0.12, phase: 1.5 },
      { x: w * 0.5, y: h * 0.4, radius: w * 0.25, color: [0, 230, 138], opacity: 0.015, drift: 0.1, phase: 3 },
      { x: w * 0.2, y: h * 0.7, radius: w * 0.2, color: [99, 102, 241], opacity: 0.018, drift: 0.08, phase: 4.5 },
    ];
    nebulaeRef.current = nebulae;
    initRef.current = true;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      init(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    const draw = () => {
      time += 0.016;
      ctx.fillStyle = "#06060a";
      ctx.fillRect(0, 0, w, h);

      // Draw nebulae
      for (const n of nebulaeRef.current) {
        const ox = Math.sin(time * n.drift + n.phase) * 20;
        const oy = Math.cos(time * n.drift * 0.7 + n.phase) * 15;
        const pulse = 1 + Math.sin(time * 0.3 + n.phase) * 0.15;
        const grad = ctx.createRadialGradient(
          n.x + ox, n.y + oy, 0,
          n.x + ox, n.y + oy, n.radius * pulse
        );
        grad.addColorStop(0, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.opacity * 1.5})`);
        grad.addColorStop(0.4, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.opacity * 0.6})`);
        grad.addColorStop(1, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Draw stars
      for (const s of starsRef.current) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
        const alpha = s.brightness * (0.4 + twinkle * 0.6);
        const r = s.color[0], g = s.color[1], b = s.color[2];

        if (s.size > 1.5) {
          // Glow for larger stars
          const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 3);
          glow.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
          glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(s.x - s.size * 3, s.y - s.size * 3, s.size * 6, s.size * 6);
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.8 + twinkle * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }

      // Vignette
      const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
      vig.addColorStop(0, "rgba(6,6,10,0)");
      vig.addColorStop(1, "rgba(6,6,10,0.6)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
