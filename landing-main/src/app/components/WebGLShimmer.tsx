import { useState, useEffect } from "react";

export default function WebGLShimmer({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {children}
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            background: "#06060a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "shimmer-fade 1.2s ease-out forwards",
            animationDelay: "0.8s",
          }}
        >
          <div style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            animation: "shimmer-pulse 1.5s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute",
            width: 160,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>
            <div style={{
              width: "40%",
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(0,230,138,0.4), transparent)",
              animation: "shimmer-bar 1.2s ease-in-out infinite",
            }} />
          </div>
        </div>
      )}
      <style>{`
        @keyframes shimmer-pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.6; }
        }
        @keyframes shimmer-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes shimmer-fade {
          to { opacity: 0; pointer-events: none; }
        }
      `}</style>
    </div>
  );
}
