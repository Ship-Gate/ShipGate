import { Routes, Route, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FrostedNav from './components/FrostedNav';
import AnimatedBackground from './components/AnimatedBackground';
import Landing from './pages/Landing';
import Pipeline from './pages/Pipeline';
import LiveAPI from './pages/LiveAPI';
import Comparison from './pages/Comparison';
import Walkthrough from './pages/Walkthrough';
import { DemoProvider, useDemoContext } from './context/DemoContext';

function AppContent() {
  const { isDemoPlaying } = useDemoContext();

  return (
    <div className="min-h-screen">
      {/* Animated Particle Background */}
      <AnimatedBackground />

      {/* Logo - Top Left */}
      <AnimatePresence>
        {!isDemoPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Link 
              to="/" 
              className="fixed top-4 left-6 z-50 flex items-center group"
            >
              <img 
                src="/logo.png" 
                alt="ISL Studio" 
                className="h-12 w-auto object-contain drop-shadow-lg group-hover:drop-shadow-[0_0_20px_rgba(14,165,233,0.6)] transition-all duration-300 scale-[1.8] origin-left my-3.5"
              />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frosted Glass Navigation */}
      <AnimatePresence>
        {!isDemoPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <FrostedNav />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`${isDemoPlaying ? 'pt-0' : 'pt-24'} relative z-10 transition-all duration-300`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/live-api" element={<LiveAPI />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DemoProvider>
      <AppContent />
    </DemoProvider>
  );
}
