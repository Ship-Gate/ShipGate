import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  color: [number, number, number];
}

export default function SmokeProblemBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const spawnParticle = useCallback((w: number, h: number): Particle => {
    const colorChoice = Math.random();
    let color: [number, number, number];
    if (colorChoice < 0.3) color = [255, 60, 60]; // red
    else if (colorChoice < 0.55) color = [255, 140, 50]; // amber
    else if (colorChoice < 0.7) color = [160, 80, 255]; // purple
    else color = [80, 80, 120]; // dark blue-grey

    return {
      x: Math.random() * w,
      y: h + Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.2 - Math.random() * 0.6,
      size: 80 + Math.random() * 200,
      opacity: 0,
      maxOpacity: 0.015 + Math.random() * 0.03,
      life: 0,
      maxLife: 300 + Math.random() * 400,
      color,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      w = canvas.parentElement?.clientWidth || window.innerWidth;
      h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      // Seed particles
      particlesRef.current = [];
      for (let i = 0; i < 40; i++) {
        const p = spawnParticle(w, h);
        p.y = Math.random() * h;
        p.life = Math.random() * p.maxLife;
        particlesRef.current.push(p);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let time = 0;

    const draw = () => {
      time += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Background subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "rgba(10, 6, 8, 0.95)");
      bgGrad.addColorStop(0.5, "rgba(6, 6, 10, 0.9)");
      bgGrad.addColorStop(1, "rgba(6, 6, 10, 0.95)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Update & draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx + Math.sin(time * 0.3 + p.y * 0.005) * 0.3;
        p.y += p.vy;
        p.size += 0.15;

        // Fade in/out
        const lifeRatio = p.life / p.maxLife;
        if (lifeRatio < 0.15) {
          p.opacity = p.maxOpacity * (lifeRatio / 0.15);
        } else if (lifeRatio > 0.7) {
          p.opacity = p.maxOpacity * (1 - (lifeRatio - 0.7) / 0.3);
        } else {
          p.opacity = p.maxOpacity;
        }

        if (p.life >= p.maxLife) {
          particles[i] = spawnParticle(w, h);
          continue;
        }

        // Draw smoke blob
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.opacity})`);
        grad.addColorStop(0.5, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.opacity * 0.4})`);
        grad.addColorStop(1, `rgba(${p.color[0]},${p.color[1]},${p.color[2]},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }

      // Center danger glow
      const centerGlow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.4);
      const pulse = 0.015 + Math.sin(time * 0.5) * 0.005;
      centerGlow.addColorStop(0, `rgba(255,60,60,${pulse})`);
      centerGlow.addColorStop(0.5, `rgba(180,40,80,${pulse * 0.4})`);
      centerGlow.addColorStop(1, "rgba(255,60,60,0)");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [spawnParticle]);

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
