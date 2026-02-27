import { ReactNode, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import './GlowCard.css';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  badge?: string;
  'data-testid'?: string;
}

export default function GlowCard({ 
  children, 
  className = '', 
  onClick,
  badge,
  'data-testid': testId,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Motion values for 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Smooth spring animation for the tilt
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  // Transform mouse position to rotation values
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['15deg', '-15deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-15deg', '15deg']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Normalize to -0.5 to 0.5
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="glow-card-scene">
      <motion.div 
        ref={cardRef}
        role={onClick ? 'button' : undefined}
        className={`glow-card ${className}`}
        onClick={onClick}
        data-testid={testId}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <span className="glow"></span>
        <div className="glow-card-content">
          {badge && <span className="glow-card-badge">{badge}</span>}
          {children}
        </div>
      </motion.div>
    </div>
  );
}
