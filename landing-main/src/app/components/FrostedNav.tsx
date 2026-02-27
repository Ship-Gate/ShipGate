import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, DollarSign, HelpCircle, Github, User, Menu, X } from 'lucide-react';
import './FrostedNav.css';

const NAV_ITEMS = [
  { path: '#How It Works', icon: Settings, label: 'How It Works' },
  { path: '#Pricing', icon: DollarSign, label: 'Pricing' },
  { path: '#FAQ', icon: HelpCircle, label: 'FAQ' },
  { path: 'https://github.com/Ship-Gate/ShipGate', icon: Github, label: 'GitHub' },
  { path: '/signin', icon: User, label: 'Sign In' },
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
  const navRef = useRef<HTMLElement>(null);
  const effectRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [effectStyle, setEffectStyle] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isTextActive, setIsTextActive] = useState(false);
  const [activeLabel, setActiveLabel] = useState('How It Works');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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
    if (navItems && navItems[index] && !isMobile) {
      updateEffectPosition(navItems[index] as HTMLElement);
    }

    setActiveLabel(label);
    setIsTextActive(false);
    
    setTimeout(() => {
      setIsTextActive(true);
    }, 100);

    setActiveIndex(index);
    if (!isMobile) {
      makeParticles();
    }
    
    // Close mobile menu if open
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }

    // Handle navigation
    if (path.indexOf('#') === 0) {
      // Internal scroll navigation
      const section = path.replace('#', '');
      const NAV_SECTIONS: Record<string, number> = {
        "How It Works": 40000 / 3,
        "Pricing": 48000 / 3,
        "FAQ": 54000 / 3,
      };
      window.scrollTo({ top: NAV_SECTIONS[section] || 0, behavior: "smooth" });
    } else if (path.indexOf('http') === 0) {
      // External link
      window.open(path, '_blank');
    } else if (path === '/signin') {
      // Navigate to sign in page
      window.location.href = '/signin';
    } else {
      // Internal route
      window.location.href = path;
    }
  }, [activeIndex, makeParticles, updateEffectPosition, isMobile, isMobileMenuOpen]);

  // Touch gesture handlers for swipe to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe && isMobileMenuOpen) {
      // Swipe left to close menu
      setIsMobileMenuOpen(false);
    }
    if (isRightSwipe && !isMobileMenuOpen) {
      // Swipe right to open menu
      setIsMobileMenuOpen(true);
    }
  }, [touchStart, touchEnd, isMobileMenuOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isMobileMenuOpen && !target.closest('.mobile-menu-overlay') && !target.closest('.mobile-menu-button')) {
        setIsMobileMenuOpen(false);
      }
    };
    
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileMenuOpen]);

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

    // Check mobile breakpoint
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial checks
    const timeoutId = setTimeout(updatePosition, 100);
    checkMobile();

    // Resize observer with throttling for performance
    let resizeTimeout: NodeJS.Timeout;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updatePosition, 16); // ~60fps throttling
    });
    
    if (navRef.current) {
      observer.observe(navRef.current);
    }

    // Throttled resize handler
    let resizeHandlerTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeHandlerTimeout);
      resizeHandlerTimeout = setTimeout(() => {
        updatePosition();
        checkMobile();
      }, 16); // ~60fps throttling
    };

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
      clearTimeout(resizeHandlerTimeout);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [activeIndex, updateEffectPosition]);

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Desktop Navigation */}
      {!isMobile && (
        <nav ref={navRef} className="frosted-nav">
          <ul>
            {NAV_ITEMS.map((item, index) => (
              <li
                key={item.path}
                className={index === activeIndex ? 'active' : ''}
                onClick={() => handleNavClick(index, item.path, item.label)}
              >
                <a href={item.path} onClick={(e) => e.preventDefault()}>
                  <item.icon size={18} className="nav-icon" />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Mobile Menu Overlay */}
      {isMobile && (
        <div 
          className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mobile-menu-content">
            {NAV_ITEMS.map((item, index) => (
              <button
                key={item.path}
                className={`mobile-menu-item ${index === activeIndex ? 'active' : ''}`}
                onClick={() => handleNavClick(index, item.path, item.label)}
              >
                <item.icon size={20} className="mobile-nav-icon" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Effect elements - only on desktop */}
      {!isMobile && (
        <>
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
      )}
    </>
  );
}
