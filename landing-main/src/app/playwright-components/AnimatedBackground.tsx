import { useEffect, useRef, useCallback } from 'react';
import './AnimatedBackground.css';

interface Point {
  x: number;
  y: number;
}

interface ClickRippleData {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: { r: number; g: number; b: number };
  update(): boolean;
  draw(): void;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });
  const clickRipplesRef = useRef<ClickRippleData[]>([]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Smooth mouse following
    mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08;
    mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let floatingOrbs: FloatingOrb[] = [];
    let time = 0;

    const colors = {
      cyan: { r: 56, g: 189, b: 248 },
      purple: { r: 139, g: 92, b: 246 },
      pink: { r: 244, g: 114, b: 182 },
      green: { r: 52, g: 211, b: 153 },
      blue: { r: 59, g: 130, b: 246 },
      amber: { r: 251, g: 191, b: 36 },
    };

    const colorKeys = Object.keys(colors) as (keyof typeof colors)[];

    class ClickRipple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      alpha: number;
      color: { r: number; g: number; b: number };

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 120 + Math.random() * 60;
        this.alpha = 0.25;
        this.color = colors[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
      }

      update(): boolean {
        this.radius += 5;
        this.alpha -= 0.008;
        return this.alpha > 0;
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // Subtle inner glow
        const gradient = ctx!.createRadialGradient(this.x, this.y, this.radius * 0.8, this.x, this.y, this.radius);
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.15})`);
        ctx!.fillStyle = gradient;
        ctx!.fill();
      }
    }

    class FloatingOrb {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      radius: number;
      color: { r: number; g: number; b: number };
      speedX: number;
      speedY: number;
      phase: number;

      constructor() {
        this.baseX = Math.random() * canvas!.width;
        this.baseY = Math.random() * canvas!.height;
        this.x = this.baseX;
        this.y = this.baseY;
        this.radius = Math.random() * 400 + 250;
        this.color = colors[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.phase = Math.random() * Math.PI * 2;
      }

      update(time: number) {
        this.x = this.baseX + Math.sin(time * 0.0005 + this.phase) * 60;
        this.y = this.baseY + Math.cos(time * 0.0004 + this.phase) * 50;
        
        // Very subtle mouse attraction
        const dx = mouseRef.current.x - this.x;
        const dy = mouseRef.current.y - this.y;
        this.x += dx * 0.003;
        this.y += dy * 0.003;
      }

      draw() {
        const gradient = ctx!.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.06)`);
        gradient.addColorStop(0.5, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.02)`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        ctx!.fillStyle = gradient;
        ctx!.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
      }
    }

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseSize: number;
      color: { r: number; g: number; b: number };
      alpha: number;
      baseAlpha: number;
      pulseSpeed: number;
      pulsePhase: number;
      trail: Point[];
      maxTrailLength: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.baseSize = Math.random() * 2 + 0.5;
        this.size = this.baseSize;
        this.color = colors[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
        this.baseAlpha = Math.random() * 0.25 + 0.1;
        this.alpha = this.baseAlpha;
        this.pulseSpeed = Math.random() * 0.01 + 0.005;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.trail = [];
        this.maxTrailLength = Math.floor(Math.random() * 5) + 3;
      }

      update(time: number) {
        // Store trail
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.pop();
        }

        // Mouse interaction - particles get pushed away
        const dx = this.x - mouseRef.current.x;
        const dy = this.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 150;

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist;
          const angle = Math.atan2(dy, dx);
          this.vx += Math.cos(angle) * force * 0.5;
          this.vy += Math.sin(angle) * force * 0.5;
          this.alpha = Math.min(1, this.baseAlpha + force * 0.5);
          this.size = this.baseSize * (1 + force * 0.5);
        } else {
          this.alpha += (this.baseAlpha - this.alpha) * 0.05;
          this.size += (this.baseSize - this.size) * 0.05;
        }

        // Pulse effect
        this.size = this.baseSize * (1 + Math.sin(time * this.pulseSpeed + this.pulsePhase) * 0.2);

        // Apply velocity with friction
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Add slight random movement
        this.vx += (Math.random() - 0.5) * 0.1;
        this.vy += (Math.random() - 0.5) * 0.1;

        // Wrap around edges
        if (this.x < -50) this.x = canvas!.width + 50;
        if (this.x > canvas!.width + 50) this.x = -50;
        if (this.y < -50) this.y = canvas!.height + 50;
        if (this.y > canvas!.height + 50) this.y = -50;
      }

      draw() {
        // Draw subtle trail
        if (this.trail.length > 1) {
          ctx!.beginPath();
          ctx!.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx!.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx!.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.15})`;
          ctx!.lineWidth = this.size * 0.3;
          ctx!.lineCap = 'round';
          ctx!.stroke();
        }

        // Draw subtle glow
        const glowGradient = ctx!.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
        glowGradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.25})`);
        glowGradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        ctx!.fillStyle = glowGradient;
        ctx!.fillRect(this.x - this.size * 3, this.y - this.size * 3, this.size * 6, this.size * 6);

        // Draw particle
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
        ctx!.fill();
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      mouseRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
      targetMouseRef.current = { x: canvas.width / 2, y: canvas.height / 2 };
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      floatingOrbs = [];
      
      const particleCount = Math.min(50, Math.floor((canvas.width * canvas.height) / 25000));
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }

      // Create fewer floating orbs
      for (let i = 0; i < 3; i++) {
        floatingOrbs.push(new FloatingOrb());
      }
    };

    const drawConnections = () => {
      const maxDist = 100;
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.1;
            const gradient = ctx!.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            gradient.addColorStop(0, `rgba(${particles[i].color.r}, ${particles[i].color.g}, ${particles[i].color.b}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${particles[j].color.r}, ${particles[j].color.g}, ${particles[j].color.b}, ${alpha})`);
            
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = gradient;
            ctx!.lineWidth = 0.3;
            ctx!.stroke();
          }
        }
      }
    };

    const drawMouseGlow = () => {
      const gradient = ctx!.createRadialGradient(
        mouseRef.current.x, mouseRef.current.y, 0,
        mouseRef.current.x, mouseRef.current.y, 150
      );
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.06)');
      gradient.addColorStop(0.5, 'rgba(56, 189, 248, 0.03)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawVignette = () => {
      const gradient = ctx!.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.4,
        canvas.width / 2, canvas.height / 2, canvas.height
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, 'rgba(240, 240, 245, 0.3)');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
    };

    const animateFrame = () => {
      time++;
      
      // Smooth mouse following
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.08;

      // Clear with slight fade for trail effect
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);

      // Draw floating orbs (background layer)
      floatingOrbs.forEach(orb => {
        orb.update(time);
        orb.draw();
      });

      // Draw mouse glow
      drawMouseGlow();

      // Draw connections between nearby particles
      drawConnections();

      // Update and draw particles
      particles.forEach(particle => {
        particle.update(time);
        particle.draw();
      });

      // Update and draw click ripples
      clickRipplesRef.current = clickRipplesRef.current.filter(ripple => {
        const alive = ripple.update();
        if (alive) ripple.draw();
        return alive;
      });

      // Draw vignette
      drawVignette();

      animationId = requestAnimationFrame(animateFrame);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: MouseEvent) => {
      clickRipplesRef.current.push(new ClickRipple(e.clientX, e.clientY));
      
      // Add subtle burst of particles near click
      for (let i = 0; i < 3; i++) {
        const p = new Particle();
        p.x = e.clientX + (Math.random() - 0.5) * 30;
        p.y = e.clientY + (Math.random() - 0.5) * 30;
        p.vx = (Math.random() - 0.5) * 2;
        p.vy = (Math.random() - 0.5) * 2;
        p.baseAlpha = 0.3;
        p.alpha = 0.3;
        particles.push(p);
      }

      // Remove excess particles
      while (particles.length > 70) {
        particles.shift();
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    
    resize();
    animateFrame();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      cancelAnimationFrame(animationId);
    };
  }, [animate]);

  return (
    <div className="animated-background">
      <canvas ref={canvasRef} className="particle-canvas" />
      <div className="scanlines" />
      <div className="gradient-overlay" />
    </div>
  );
}
