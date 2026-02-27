import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useIsMobile } from "../../lib/useIsMobile";
import GalaxyShader from "../GalaxyShader";

/**
 * SplineScene — Hero 3D scene via @splinetool/react-spline.
 *
 * Lazy-loads the Spline runtime (~800KB) so it never blocks
 * first paint. GalaxyShader renders immediately as the loading
 * state and persists as the mobile fallback.
 *
 * The Spline canvas fades in over the GalaxyShader once the
 * 3D scene is fully loaded and interactive.
 *
 * THREE.WebGLProgram shader warnings (f_sobelSample, f_blur)
 * are suppressed — they are benign info-log noise from Spline's
 * internal post-processing shaders and cannot be fixed from
 * consumer code.
 */

/* Lazy-load the heavy Spline runtime — code-split from main bundle */
const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  /** .splinecode scene URL from spline.design */
  sceneUrl?: string;
}

/**
 * Patches console.warn to silence THREE.WebGLProgram shader
 * info-log warnings that Spline's runtime emits. Returns a
 * cleanup function that restores the original console.warn.
 */
function suppressThreeShaderWarnings(): () => void {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("THREE.WebGLProgram") ||
      msg.includes("f_sobelSample") ||
      msg.includes("f_blur")
    ) {
      return; // swallow known Spline shader noise
    }
    originalWarn.apply(console, args);
  };
  return () => {
    console.warn = originalWarn;
  };
}

export default function SplineScene({ sceneUrl }: SplineSceneProps) {
  const isMobile = useIsMobile();
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Suppress THREE shader warnings while Spline is active */
  useEffect(() => {
    if (isMobile || !sceneUrl) return;
    const restore = suppressThreeShaderWarnings();
    return restore;
  }, [isMobile, sceneUrl]);

  /* Mobile or no URL → GalaxyShader canvas only */
  if (isMobile || !sceneUrl) {
    return (
      <div ref={containerRef} className="absolute inset-0 w-full h-full">
        <GalaxyShader />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      {/* GalaxyShader stays visible until Spline is ready */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          opacity: loaded ? 0 : 1,
          transition: "opacity 1.2s ease-out",
          pointerEvents: loaded ? "none" : "auto",
        }}
      >
        <GalaxyShader />
      </div>

      {/* Spline 3D scene — fades in over the galaxy */}
      <Suspense fallback={null}>
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: loaded ? 1 : 0,
            transition: "opacity 1.2s ease-out",
          }}
        >
          <Spline
            scene={sceneUrl}
            onLoad={() => setLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              pointerEvents: "none",
            }}
          />
        </div>
      </Suspense>
    </div>
  );
}
