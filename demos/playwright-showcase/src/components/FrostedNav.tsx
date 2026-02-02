import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Workflow, Server, GitCompare, PlayCircle } from 'lucide-react';
import './FrostedNav.css';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/pipeline', icon: Workflow, label: 'Pipeline' },
  { path: '/live-api', icon: Server, label: 'Live API' },
  { path: '/comparison', icon: GitCompare, label: 'Compare' },
  { path: '/walkthrough', icon: PlayCircle, label: 'Walkthrough' },
];

const colors = [1, 2, 3, 1, 2, 3, 1, 4];
const animationTime = 600;
const timeVariance = 300;
const pCount = 15;

function noise(n = 1) {
  return n / 2 - Math.random() * n;
}

function getXY(distance: number, pointIndex: number, totalPoints: number): [number, number] {
  const x = distance * Math.cos((((360 + noise(8)) / totalPoints) * pointIndex * Math.PI) / 180);
  const y = distance * Math.sin((((360 + noise(8)) / totalPoints) * pointIndex * Math.PI) / 180);
  return [x, y];
}

function createParticle(i: number, t: number, d: [number, number], r: number) {
  const rotate = noise(r / 10);
  const minDistance = d[0];
  const maxDistance = d[1];
  return {
    start: getXY(minDistance, pCount - i, pCount),
    end: getXY(maxDistance + noise(7), pCount - i, pCount),
    time: t,
    scale: 1 + noise(0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
  };
}

interface Particle {
  id: number;
  start: [number, number];
  end: [number, number];
  time: number;
  scale: number;
  color: number;
  rotate: number;
}

export default function FrostedNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const effectRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [effectStyle, setEffectStyle] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isTextActive, setIsTextActive] = useState(false);
  const [activeLabel, setActiveLabel] = useState('Home');

  // Find active index based on current route
  useEffect(() => {
    const index = NAV_ITEMS.findIndex(item => item.path === location.pathname);
    if (index !== -1 && index !== activeIndex) {
      setActiveIndex(index);
    }
  }, [location.pathname, activeIndex]);

  const updateEffectPosition = useCallback((element: HTMLElement) => {
    const pos = element.getBoundingClientRect();
    setEffectStyle({
      left: pos.x,
      top: pos.y,
      width: pos.width,
      height: pos.height,
    });
  }, []);

  const makeParticles = useCallback(() => {
    const d: [number, number] = [90, 10];
    const r = 100;
    const newParticles: Particle[] = [];

    for (let i = 0; i < pCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, d, r);
      newParticles.push({ ...p, id: Date.now() + i });
    }

    setParticles(newParticles);

    // Clear particles after animation
    setTimeout(() => {
      setParticles([]);
    }, animationTime * 2 + timeVariance + 500);
  }, []);

  const handleNavClick = useCallback((index: number, path: string, label: string) => {
    if (index === activeIndex) return;

    const navItems = navRef.current?.querySelectorAll('li');
    if (navItems && navItems[index]) {
      updateEffectPosition(navItems[index] as HTMLElement);
    }

    setActiveLabel(label);
    setIsTextActive(false);
    
    setTimeout(() => {
      setIsTextActive(true);
    }, 100);

    setActiveIndex(index);
    makeParticles();
    navigate(path);
  }, [activeIndex, makeParticles, navigate, updateEffectPosition]);

  // Update effect position on mount and resize
  useEffect(() => {
    const updatePosition = () => {
      const navItems = navRef.current?.querySelectorAll('li');
      if (navItems && navItems[activeIndex]) {
        updateEffectPosition(navItems[activeIndex] as HTMLElement);
        setActiveLabel(NAV_ITEMS[activeIndex].label);
        setIsTextActive(true);
      }
    };

    // Initial position
    setTimeout(updatePosition, 100);

    // Resize observer
    const observer = new ResizeObserver(updatePosition);
    if (navRef.current) {
      observer.observe(navRef.current);
    }

    window.addEventListener('resize', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [activeIndex, updateEffectPosition]);

  return (
    <>
      <nav ref={navRef} className="frosted-nav">
        <ul>
          {NAV_ITEMS.map((item, index) => (
            <li
              key={item.path}
              className={index === activeIndex ? 'active' : ''}
              onClick={() => handleNavClick(index, item.path, item.label)}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <a href={item.path} onClick={(e) => e.preventDefault()}>
                <item.icon size={18} className="nav-icon" />
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Effect elements */}
      <span
        ref={effectRef}
        className={`effect filter ${particles.length > 0 ? 'active' : ''}`}
        style={{
          left: effectStyle.left,
          top: effectStyle.top,
          width: effectStyle.width,
          height: effectStyle.height,
        }}
      >
        {particles.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              '--start-x': `${p.start[0]}px`,
              '--start-y': `${p.start[1]}px`,
              '--end-x': `${p.end[0]}px`,
              '--end-y': `${p.end[1]}px`,
              '--time': `${p.time}ms`,
              '--scale': p.scale,
              '--color': `var(--color-${p.color}, white)`,
              '--rotate': `${p.rotate}deg`,
            } as React.CSSProperties}
          >
            <span className="point" />
          </span>
        ))}
      </span>
      
      <span
        ref={textRef}
        className={`effect text ${isTextActive ? 'active' : ''}`}
        style={{
          left: effectStyle.left,
          top: effectStyle.top,
          width: effectStyle.width,
          height: effectStyle.height,
          opacity: effectStyle.width > 0 ? 1 : 0,
        }}
      >
        {activeLabel}
      </span>
    </>
  );
}
