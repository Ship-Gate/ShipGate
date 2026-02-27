import { useRef, useEffect, useState } from "react";
import Lottie from "lottie-react";

/**
 * LottieDivider — Animated section separator.
 *
 * Uses lottie-react with an inline animation (pulsing energy line).
 * The animation is defined as a valid Lottie JSON object — no external
 * file dependency. In production, swap `animationData` with a
 * designer-exported JSON from lottiefiles.com or After Effects.
 *
 * The component pauses when offscreen (IntersectionObserver)
 * to avoid unnecessary GPU work on background layers.
 *
 * To use a custom Lottie file:
 *   <LottieDivider src="/animations/divider.json" />
 * Or pass data directly:
 *   <LottieDivider animationData={myLottieData} />
 */

/* ── Inline Lottie animation: pulsing gradient line ── */
const DIVIDER_ANIMATION = {
  v: "5.7.1",
  fr: 30,
  ip: 0,
  op: 90,
  w: 1200,
  h: 40,
  nm: "energy-line",
  ddd: 0,
  assets: [],
  layers: [
    /* Center glow dot */
    {
      ddd: 0,
      ind: 1,
      ty: 1,
      nm: "center-glow",
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [15], h: 0 },
            { t: 45, s: [40], h: 0 },
            { t: 90, s: [15] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [600, 20, 0] },
        a: { a: 0, k: [30, 1, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100], h: 0 },
            { t: 45, s: [160, 100, 100], h: 0 },
            { t: 90, s: [100, 100, 100] },
          ],
        },
      },
      sc: "#00e68a",
      sw: 60,
      sh: 2,
      ip: 0,
      op: 90,
      st: 0,
    },
    /* Wide subtle line */
    {
      ddd: 0,
      ind: 2,
      ty: 1,
      nm: "wide-line",
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: [
            { t: 0, s: [6], h: 0 },
            { t: 45, s: [14], h: 0 },
            { t: 90, s: [6] },
          ],
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [600, 20, 0] },
        a: { a: 0, k: [400, 0.5, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [80, 100, 100], h: 0 },
            { t: 45, s: [100, 100, 100], h: 0 },
            { t: 90, s: [80, 100, 100] },
          ],
        },
      },
      sc: "#6366f1",
      sw: 800,
      sh: 1,
      ip: 0,
      op: 90,
      st: 0,
    },
  ],
};

interface LottieDividerProps {
  /** Override with custom animation data from a .json export */
  animationData?: object;
  /** Accent color variant */
  color?: "green" | "purple" | "amber";
  className?: string;
}

export default function LottieDivider({
  animationData,
  color = "green",
  className = "",
}: LottieDividerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  /* Pause animation when offscreen */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Control Lottie playback based on visibility */
  useEffect(() => {
    if (!lottieRef.current) return;
    if (isVisible) {
      lottieRef.current.play();
    } else {
      lottieRef.current.pause();
    }
  }, [isVisible]);

  const colorClass =
    color === "purple"
      ? "lottie-divider--purple"
      : color === "amber"
      ? "lottie-divider--amber"
      : "lottie-divider--green";

  return (
    <div
      ref={containerRef}
      className={`lottie-divider ${colorClass} ${className}`}
      aria-hidden="true"
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData || DIVIDER_ANIMATION}
        loop
        autoplay={false}
        style={{
          width: "100%",
          maxWidth: 600,
          height: 40,
          margin: "0 auto",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}
        rendererSettings={{
          preserveAspectRatio: "xMidYMid slice",
        }}
      />

      <style>{`
        .lottie-divider {
          position: relative;
          width: 100%;
          padding: 20px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* Gradient fade edges */
        .lottie-divider::before,
        .lottie-divider::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 30%;
          height: 1px;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .lottie-divider::before { left: 0; }
        .lottie-divider::after  { right: 0; }

        .lottie-divider--green::before {
          background: linear-gradient(90deg, transparent, rgba(0,230,138,0.08));
        }
        .lottie-divider--green::after {
          background: linear-gradient(270deg, transparent, rgba(0,230,138,0.08));
        }

        .lottie-divider--purple::before {
          background: linear-gradient(90deg, transparent, rgba(99,102,241,0.08));
        }
        .lottie-divider--purple::after {
          background: linear-gradient(270deg, transparent, rgba(99,102,241,0.08));
        }

        .lottie-divider--amber::before {
          background: linear-gradient(90deg, transparent, rgba(255,181,71,0.08));
        }
        .lottie-divider--amber::after {
          background: linear-gradient(270deg, transparent, rgba(255,181,71,0.08));
        }
      `}</style>
    </div>
  );
}
