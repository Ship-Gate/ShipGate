import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

interface CursorPosition {
  x: number;
  y: number;
}

interface DemoCursorProps {
  targetSelector?: string;
  isClicking?: boolean;
  isVisible?: boolean;
  onArrived?: () => void;
}

export default function DemoCursor({
  targetSelector,
  isClicking = false,
  isVisible = true,
  onArrived,
}: DemoCursorProps) {
  const [position, setPosition] = useState<CursorPosition>({ x: 100, y: 100 });
  const [showRipple, setShowRipple] = useState(false);

  const moveToTarget = useCallback(() => {
    if (!targetSelector) return;

    const target = document.querySelector(targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      const newX = rect.left + rect.width / 2;
      const newY = rect.top + rect.height / 2;
      setPosition({ x: newX, y: newY });
    }
  }, [targetSelector]);

  useEffect(() => {
    moveToTarget();
  }, [moveToTarget]);

  useEffect(() => {
    if (isClicking) {
      setShowRipple(true);
      const timer = setTimeout(() => {
        setShowRipple(false);
        onArrived?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isClicking, onArrived]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Cursor */}
      <motion.div
        className="absolute"
        animate={{ x: position.x - 4, y: position.y - 4 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20 }}
      >
        {/* Cursor SVG */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="drop-shadow-lg"
        >
          <path
            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
            fill="#fff"
            stroke="#000"
            strokeWidth="1.5"
          />
        </svg>

        {/* Click Ripple Effect */}
        <AnimatePresence>
          {showRipple && (
            <motion.div
              className="absolute top-1 left-1"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <div className="w-8 h-8 rounded-full bg-intent-400/50" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Target Highlight */}
      {targetSelector && (
        <TargetHighlight selector={targetSelector} />
      )}
    </div>
  );
}

function TargetHighlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    const interval = setInterval(updateRect, 100);

    return () => {
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [selector]);

  if (!rect) return null;

  return (
    <motion.div
      className="absolute border-2 border-intent-400 rounded-lg pointer-events-none"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        left: rect.left - 4,
        top: rect.top - 4,
        width: rect.width + 8,
        height: rect.height + 8,
      }}
    >
      <motion.div
        className="absolute inset-0 bg-intent-400/10 rounded-lg"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.div>
  );
}
