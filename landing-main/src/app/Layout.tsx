import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import FrostedNav from './components/FrostedNav';
import CookieBanner from './components/CookieBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <>
      <FrostedNav />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <CookieBanner />
    </>
  );
}
