import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton } from '@clerk/clerk-react';
import './MagicalNavbar.css';

const clerkPublishableKey = typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'string'
  ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  : '';

function AuthActionsStatic() {
  return (
    <>
      <Link to="/sign-in" className="magical-nav-link text-sm font-medium opacity-90 hover:opacity-100">Sign in</Link>
      <Link to="/sign-up" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">Get started</Link>
    </>
  );
}

function AuthActionsWithClerk() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) {
    return (
      <>
        <Link to="/dashboard" className="magical-nav-link text-sm font-medium">Dashboard</Link>
        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'h-9 w-9' } }} />
      </>
    );
  }
  return (
    <>
      <Link to="/sign-in" className="magical-nav-link text-sm font-medium opacity-90 hover:opacity-100">Sign in</Link>
      <Link to="/sign-up" className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">Get started</Link>
    </>
  );
}

const NAV_LINKS = [
  { to: '/', hash: '#how-it-works', label: 'Overview' },
  { to: '/', hash: '#what-we-catch', label: 'Catches' },
  { to: '/pricing', hash: undefined, label: 'Pricing' },
  { to: '/', hash: '#faq', label: 'FAQ' },
];

export default function MagicalNavbar() {
  const navbarRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const navbar = navbarRef.current;
    const indicator = indicatorRef.current;
    const navMenu = menuRef.current;
    const root = document.documentElement;
    const body = document.body;

    if (!navbar || !indicator || !navMenu) return;

    const navLinks = navMenu.querySelectorAll<HTMLAnchorElement>('.magical-nav-link');

    const handleMouseMove = (e: MouseEvent) => {
      const rect = navbar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      root.style.setProperty('--mouse-x', `${x}px`);
      root.style.setProperty('--mouse-y', `${y}px`);
    };

    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY;

          if (currentScrollY > 50) {
            body.classList.add('magical-nav-scrolled');
          } else {
            body.classList.remove('magical-nav-scrolled');
          }

          const velocity = Math.max(Math.min(delta * 0.15, 10), -10);
          root.style.setProperty('--scroll-velocity', `${velocity}`);
          lastScrollY = currentScrollY;
          ticking = false;

          clearTimeout((window as Window & { magicalNavScrollTimeout?: ReturnType<typeof setTimeout> }).magicalNavScrollTimeout);
          (window as Window & { magicalNavScrollTimeout?: ReturnType<typeof setTimeout> }).magicalNavScrollTimeout = setTimeout(() => {
            root.style.setProperty('--scroll-velocity', '0');
          }, 100);
        });
        ticking = true;
      }
    };

    const moveIndicator = (el: HTMLElement) => {
      const menuRect = navMenu.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const left = elRect.left - menuRect.left;
      indicator.style.width = `${elRect.width}px`;
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.opacity = '1';
    };

    navbar.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    navLinks.forEach((link) => {
      link.addEventListener('mouseenter', (e) => { const el = e.currentTarget; if (el instanceof HTMLElement) moveIndicator(el); });
    });
    navMenu.addEventListener('mouseleave', () => {
      indicator.style.opacity = '0';
    });

    return () => {
      navbar.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      body.classList.remove('magical-nav-scrolled');
    };
  }, []);

  return (
    <div className="magical-stage" aria-hidden>
      <nav ref={navbarRef} className="magical-navbar-card" id="magical-navbar" aria-label="Main">
        <Link to="/" className="magical-brand-container">
          <span className="magical-logo-text">Shipgate</span>
        </Link>

        <div ref={menuRef} className="magical-nav-menu">
          <div ref={indicatorRef} className="magical-nav-indicator" id="magical-nav-indicator" aria-hidden />
          {NAV_LINKS.map(({ to, hash, label }) => (
            <Link
              key={to + (hash ?? '')}
              to={hash ? `${to}${hash}` : to}
              className="magical-nav-link"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="magical-actions-container flex items-center gap-3">
          {clerkPublishableKey ? <AuthActionsWithClerk /> : <AuthActionsStatic />}
          <button type="button" className="magical-mobile-toggle" aria-label="Open menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}
