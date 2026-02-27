import { useState, useRef, useCallback } from "react";

/**
 * RiveButton — CTA button with CSS-driven state machine.
 *
 * States mirror a Rive state machine:
 *   idle    → subtle shimmer sweep
 *   hover   → glow expansion + border brighten
 *   active  → press scale-down
 *   success → pulse confirmation
 *
 * To swap in a real Rive asset:
 * 1. Install: pnpm add @rive-app/react-canvas
 * 2. Export your .riv from rive.app with a state machine named "button"
 * 3. Replace the <button> JSX with:
 *    <RiveComponent
 *      src="/animations/button.riv"
 *      stateMachines="button"
 *      style={{ width: '100%', height: '100%' }}
 *    />
 * 4. Wire hover/click inputs to the state machine via useStateMachineInput
 */

interface RiveButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary";
}

export default function RiveButton({
  children,
  href,
  onClick,
  className = "",
  variant = "primary",
}: RiveButtonProps) {
  const [state, setState] = useState<"idle" | "hover" | "active" | "success">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = useCallback(() => {
    setState("active");
    clearTimeout(timeoutRef.current);

    /* Active → Success → Idle cycle */
    timeoutRef.current = setTimeout(() => {
      setState("success");
      timeoutRef.current = setTimeout(() => setState("idle"), 600);
    }, 150);

    onClick?.();
  }, [onClick]);

  const isPrimary = variant === "primary";

  const Tag = href ? "a" : "button";
  const linkProps = href ? { href } : {};

  return (
    <Tag
      {...linkProps}
      onClick={handleClick}
      onMouseEnter={() => setState("hover")}
      onMouseLeave={() => {
        if (state !== "active" && state !== "success") setState("idle");
      }}
      onFocus={() => setState("hover")}
      onBlur={() => setState("idle")}
      className={`rive-btn rive-btn--${variant} rive-btn--${state} ${className}`}
      role="button"
      tabIndex={0}
      aria-label={typeof children === "string" ? children : undefined}
    >
      {/* Shimmer sweep layer */}
      <span className="rive-btn__shimmer" aria-hidden="true" />

      {/* Glow ring layer */}
      <span className="rive-btn__glow" aria-hidden="true" />

      {/* Content */}
      <span className="rive-btn__content">{children}</span>

      <style>{`
        .rive-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          overflow: hidden;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.3s ease;
          outline: none;
        }

        /* Focus ring for accessibility */
        .rive-btn:focus-visible {
          outline: 2px solid #00e68a;
          outline-offset: 3px;
        }

        /* ─── Primary variant ─── */
        .rive-btn--primary {
          background: linear-gradient(135deg, #00e68a, #00cc7a);
          color: #000;
          box-shadow: 0 0 0 0 rgba(0,230,138,0);
        }

        .rive-btn--primary.rive-btn--hover {
          transform: translateY(-1px);
          box-shadow: 0 0 30px rgba(0,230,138,0.3),
                      0 8px 20px rgba(0,230,138,0.15);
        }

        .rive-btn--primary.rive-btn--active {
          transform: scale(0.97);
          box-shadow: 0 0 15px rgba(0,230,138,0.2);
        }

        .rive-btn--primary.rive-btn--success {
          transform: scale(1.02);
          box-shadow: 0 0 40px rgba(0,230,138,0.4),
                      0 0 80px rgba(0,230,138,0.15);
        }

        /* ─── Secondary variant ─── */
        .rive-btn--secondary {
          background: rgba(255,255,255,0.04);
          color: #c8c8d4;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: none;
        }

        .rive-btn--secondary.rive-btn--hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .rive-btn--secondary.rive-btn--active {
          transform: scale(0.97);
        }

        /* ─── Shimmer sweep ─── */
        .rive-btn__shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 30%,
            rgba(255,255,255,0.15) 50%,
            transparent 70%
          );
          transform: translateX(-100%);
          pointer-events: none;
        }

        .rive-btn--primary .rive-btn__shimmer {
          animation: shimmer-sweep 3s ease-in-out infinite;
        }

        .rive-btn--hover .rive-btn__shimmer,
        .rive-btn--active .rive-btn__shimmer {
          animation: none;
          transform: translateX(100%);
        }

        @keyframes shimmer-sweep {
          0%, 70% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* ─── Glow ring ─── */
        .rive-btn__glow {
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }

        .rive-btn--primary .rive-btn__glow {
          background: linear-gradient(135deg, #00e68a, #6366f1);
          filter: blur(8px);
        }

        .rive-btn--primary.rive-btn--hover .rive-btn__glow {
          opacity: 0.3;
        }

        .rive-btn--primary.rive-btn--success .rive-btn__glow {
          opacity: 0.5;
          animation: glow-pulse 0.6s ease-out;
        }

        @keyframes glow-pulse {
          0% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.2); }
        }

        /* ─── Content ─── */
        .rive-btn__content {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 640px) {
          .rive-btn {
            padding: 12px 24px;
            font-size: 14px;
          }
        }
      `}</style>
    </Tag>
  );
}
