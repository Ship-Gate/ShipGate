import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import Lenis from "lenis";
import "./tunnel.css";

const SPEED_FACTOR = 15.0;
const ROCKET_SPEED_FACTOR = 0.25;

// Zoomed-out fade distances — cards visible from further away
const FAR_FADE_START = -9000;
const FAR_FADE_END = -4800;
const NEAR_FADE_START = 1000;
const NEAR_FADE_END = 1900;

// Snap-lock settings
const SNAP_DEBOUNCE_MS = 70; // Wait this long after scroll settles to snap
const SNAP_DURATION = 1.1; // Snap animation duration in seconds
const SNAP_DEAD_ZONE = 60; // Z distance threshold — if already this close, don't snap
const STICKY_RANGE = 9500; // Z distance for card straightening + slowdown

interface ScrollTunnelProps {
  children: ReactNode;
  tunnelScrollRef?: RefObject<number>;
  totalDepth?: number;
}

export function ScrollTunnel({
  children,
  tunnelScrollRef,
  totalDepth = 10000,
}: ScrollTunnelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Snap state
  const isSnappingRef = useRef(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCardIndexRef = useRef(0);
  const isMobileRef = useRef(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;

    let hasUserInteracted = false;

    isMobileRef.current =
      window.innerWidth < 768 || "ontouchstart" in window;

    /* ── Lenis smooth scroll ── */
    const lenis = new Lenis({
      lerp: isMobileRef.current ? 0.001 : 0.06,
      touchMultiplier: isMobileRef.current ? 2.0 : 1.35,
      wheelMultiplier: 0.55,
    });

    let scrollPos = 0;
    let velocity = 0;
    let targetVelocity = 0;
    let raf = 0;

    /* ── Collect section Z positions ── */
    const sectionZs: number[] = [];
    world.querySelectorAll<HTMLElement>("[data-tunnel-z]").forEach((el) => {
      sectionZs.push(parseFloat(el.dataset.tunnelZ || "0"));
    });

    // Sort descending (closest first in tunnel order: 0, -2000, -4000…)
    const sortedZs = [...sectionZs].sort((a, b) => b - a);

    /* ── Snap helpers ── */
    const getScrollForZ = (z: number): number => -z / SPEED_FACTOR;

    const findNearestCardIndex = (scroll: number): number => {
      const currentDist = scroll * SPEED_FACTOR;
      let closest = 0;
      let closestDist = Infinity;
      sortedZs.forEach((z, i) => {
        const dist = Math.abs(z + currentDist);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      return closest;
    };

    const snapToNearest = () => {
      if (isSnappingRef.current) return;

      const idx = findNearestCardIndex(scrollPos);
      const targetZ = sortedZs[idx];
      const vizZ = targetZ + scrollPos * SPEED_FACTOR;

      // Don't snap if already very close
      if (Math.abs(vizZ) < SNAP_DEAD_ZONE) {
        currentCardIndexRef.current = idx;
        return;
      }

      const targetScroll = getScrollForZ(targetZ);
      isSnappingRef.current = true;
      currentCardIndexRef.current = idx;

      lenis.scrollTo(targetScroll, {
        duration: SNAP_DURATION,
        easing: (t: number) => 1 - Math.pow(1 - t, 4), // ease-out quart
        onComplete: () => {
          isSnappingRef.current = false;
        },
      });
    };

    const scheduleSnap = () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      snapTimerRef.current = setTimeout(snapToNearest, SNAP_DEBOUNCE_MS);
    };

    /* ── Lenis scroll callback ── */
    lenis.on("scroll", (e: { scroll: number; velocity: number }) => {
      scrollPos = e.scroll;
      targetVelocity = e.velocity;

      // Schedule snap only when user is not aggressively scrolling.
      // (This prevents jitter/cancel loops and makes the lock-in feel intentional.)
      if (
        hasUserInteracted &&
        !isSnappingRef.current &&
        Math.abs(e.velocity) < 1.2
      )
        scheduleSnap();
    });

    const onFirstInteract = () => {
      hasUserInteracted = true;
    };
    window.addEventListener("wheel", onFirstInteract, { passive: true });
    window.addEventListener("touchstart", onFirstInteract, { passive: true });

    /* ── Animation loop ── */
    const tick = (time: number) => {
      lenis.raf(time);

      // Smooth velocity for warp effect
      velocity += (targetVelocity - velocity) * 0.08;

      const currentDist = scrollPos * SPEED_FACTOR;

      // Track current card
      currentCardIndexRef.current = findNearestCardIndex(scrollPos);

      /* Sticky factor: how close are we to any section center? */
      let minAbsViz = Infinity;
      for (const sz of sectionZs) {
        const vizZ = sz + currentDist;
        if (Math.abs(vizZ) < minAbsViz) minAbsViz = Math.abs(vizZ);
      }

      // Don't apply sticky to last card (allows clean exit)
      const lastCardZ = Math.min(...sectionZs);
      const isNearLastCard = Math.abs(lastCardZ + currentDist) < STICKY_RANGE;
      const nearSection = minAbsViz < STICKY_RANGE && !isNearLastCard;
      const stickyFactor = nearSection
        ? 1.0 - Math.min(minAbsViz / STICKY_RANGE, 1.0)
        : 0;

      /* Update external scroll progress ref */
      if (tunnelScrollRef) {
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        const p = maxScroll > 0 ? Math.min(scrollPos / maxScroll, 1) : 0;
        (tunnelScrollRef as React.MutableRefObject<number>).current =
          Math.max(0, Math.min(1, p * ROCKET_SPEED_FACTOR));
      }

      /* Dynamic perspective — zoomed out base, subtle warp with speed */
      const warp = Math.min(Math.abs(velocity) * 1.2, 150);
      const basePerspective = isMobileRef.current ? 3000 : 3600;
      viewport.style.perspective = `${basePerspective - warp}px`;

      /* World tilt + curve sway — damped near sticky sections */
      const scrollProgress = tunnelScrollRef
        ? (tunnelScrollRef as React.MutableRefObject<number>).current
        : 0;
      const tunnelZ = scrollProgress * 600.0;
      const dampFactor = 1.0 - stickyFactor * 0.85;
      const rawRoll = (Math.cos(tunnelZ * 0.12) - 1.0) * 4;
      const rawShiftX = Math.sin(tunnelZ * 0.12) * 8;
      const rawShiftY = (Math.cos(tunnelZ * 0.08) - 1.0) * 5;
      world.style.transform = `rotateX(${-velocity * 0.025 * dampFactor}deg) rotateZ(${rawRoll * dampFactor}deg) translate3d(${rawShiftX * dampFactor}px, ${rawShiftY * dampFactor}px, 0px)`;

      /* Move each tunnel section in Z */
      const sections =
        world.querySelectorAll<HTMLElement>("[data-tunnel-z]");
      sections.forEach((el) => {
        const baseZ = parseFloat(el.dataset.tunnelZ || "0");
        const vizZ = baseZ + currentDist;

        // Opacity: fade in from distance, fade out behind camera
        let alpha = 1;
        if (vizZ < FAR_FADE_START) {
          alpha = 0;
        } else if (vizZ < FAR_FADE_END) {
          alpha =
            (vizZ - FAR_FADE_START) / (FAR_FADE_END - FAR_FADE_START);
        }
        if (vizZ > NEAR_FADE_START) {
          alpha = Math.max(
            0,
            1 -
              (vizZ - NEAR_FADE_START) /
                (NEAR_FADE_END - NEAR_FADE_START)
          );
        }
        alpha = Math.max(0, Math.min(1, alpha));

        // Straighten card X offset when in sticky zone
        const rawOffsetX = parseFloat(el.dataset.tunnelX || "0");
        const cardDist = Math.abs(vizZ);
        const cardSticky =
          cardDist < STICKY_RANGE ? 1.0 - cardDist / STICKY_RANGE : 0;
        const offsetX = rawOffsetX * (1.0 - cardSticky);

        // Subtle scale bump when card is centered (feels like "locking in")
        const scaleBoost = 1.0 + cardSticky * 0.03;

        el.style.opacity = String(alpha);
        el.style.transform = `translate(-50%, -50%) translate3d(${offsetX}px, 0px, ${vizZ}px) scale(${scaleBoost})`;
        el.style.pointerEvents = alpha > 0.3 ? "auto" : "none";
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // Handle resize — update mobile flag
    const handleResize = () => {
      isMobileRef.current =
        window.innerWidth < 768 || "ontouchstart" in window;
      lenis.options.lerp = isMobileRef.current ? 0.075 : 0.06;
    };
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      lenis.destroy();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("wheel", onFirstInteract);
      window.removeEventListener("touchstart", onFirstInteract);
    };
  }, [tunnelScrollRef, totalDepth]);

  // Scroll proxy height — enough to scroll through the full depth
  const proxyPx = totalDepth / SPEED_FACTOR + 300;

  return (
    <>
      {/* 3D viewport — pinned to screen */}
      <div className="tunnel-viewport" ref={viewportRef}>
        <div className="tunnel-world" ref={worldRef}>
          {children}
        </div>
      </div>

      {/* Radial depth-fog vignette */}
      <div className="tunnel-depth-mask" />

      {/* Invisible tall div — creates native scroll space */}
      <div className="tunnel-scroll-proxy" style={{ height: proxyPx }} />
    </>
  );
}

/* ── Thin wrapper: positions content at a Z depth ── */
interface TunnelSectionProps {
  z: number;
  x?: number;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  width?: string;
}

export function TunnelSection({
  z,
  x = 0,
  children,
  className = "",
  style,
  width = "100vw",
}: TunnelSectionProps) {
  return (
    <div
      className={`tunnel-section ${className}`}
      data-tunnel-z={z}
      data-tunnel-x={x}
      style={{ maxWidth: width, ...style }}
    >
      {children}
    </div>
  );
}