import { useEffect, useState, type RefObject } from "react";

const SECTION_LABELS = [
  "Hero", "Problem", "Proof", "Compliance", "Terminal",
  "Social Proof", "How It Works", "Testimonials", "Dashboard", "Pricing", "FAQ", "CTA",
];

export default function ScrollDots({
  currentCardRef,
  totalSections,
}: {
  currentCardRef: RefObject<number>;
  totalSections: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const idx = (currentCardRef as React.MutableRefObject<number>).current ?? 0;
      setActive((prev) => (prev !== idx ? idx : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentCardRef]);

  const count = Math.min(totalSections, SECTION_LABELS.length);

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "flex-end",
      }}
      aria-label="Section navigation"
      role="navigation"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: active === i ? "rgba(255,255,255,0.8)" : "transparent",
              transition: "color 0.4s, opacity 0.4s",
              fontWeight: 500,
              letterSpacing: "0.04em",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {SECTION_LABELS[i] ?? ""}
          </span>
          <div
            style={{
              width: active === i ? 10 : 6,
              height: active === i ? 10 : 6,
              borderRadius: "50%",
              background: active === i
                ? "linear-gradient(135deg, #00e68a, #6366f1)"
                : "rgba(255,255,255,0.2)",
              transition: "all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
              boxShadow: active === i ? "0 0 12px rgba(0,230,138,0.4)" : "none",
              cursor: "default",
              flexShrink: 0,
            }}
            aria-current={active === i ? "step" : undefined}
          />
        </div>
      ))}
    </div>
  );
}
