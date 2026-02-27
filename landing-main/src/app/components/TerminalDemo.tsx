// src/components/TerminalDemo.tsx
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { T } from "../theme";
import { useInViewOnce } from "../hooks/useInViewOnce";

export interface TermLine {
  text: string;
  color?: string;
  prefix?: string;
  prefixColor?: string;
}

export function TerminalDemo({ lines, title = "Terminal" }: { lines: TermLine[]; title?: string }) {
  const reduceMotion = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(0);
  const [ref, inView] = useInViewOnce<HTMLDivElement>(0.3);

  useEffect(() => {
    if (!inView) return;

    if (reduceMotion) {
      setVisibleLines(lines.length);
      return;
    }

    let raf = 0;
    let last = performance.now();
    let i = 0;

    const tick = (now: number) => {
      const dt = now - last;
      if (dt > 85) {
        last = now;
        i++;
        setVisibleLines(i);
        if (i >= lines.length) return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, lines.length, reduceMotion]);

  return (
    <div
      ref={ref}
      style={{
        background: "#0a0a12",
        borderRadius: 12,
        border: `1px solid ${T.border}`,
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        lineHeight: 1.7,
        boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
        willChange: "transform",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          background: "rgba(255,255,255,0.02)",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
        </div>
        <span style={{ fontSize: 11, color: T.text3, marginLeft: 8 }}>{title}</span>
      </div>

      <div style={{ padding: "16px 20px", minHeight: 200, overflowX: "auto" }}>
        {lines.slice(0, visibleLines).map((l, idx) => (
          <div key={idx} style={{ color: l.color || T.text2, whiteSpace: "pre" }}>
            {l.prefix && <span style={{ color: l.prefixColor || T.text3 }}>{l.prefix}</span>}
            {l.text}
          </div>
        ))}

        {visibleLines < lines.length && !reduceMotion && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 16,
              background: T.ship,
              animation: "cursor-blink 1s infinite",
              verticalAlign: "middle",
            }}
          />
        )}
      </div>
    </div>
  );
}
