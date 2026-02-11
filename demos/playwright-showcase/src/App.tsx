import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import StarBackground from './components/StarBackground';
import MagicalNavbar from './components/MagicalNavbar';
import Landing from './pages/Landing';
import Docs from './pages/Docs';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Security from './pages/Security';
import Contact from './pages/Contact';
import About from './pages/About';
import Pipeline from './pages/Pipeline';
import LiveAPI from './pages/LiveAPI';
import Comparison from './pages/Comparison';
import Walkthrough from './pages/Walkthrough';
import Pricing from './pages/Pricing';
import Dashboard from './pages/Dashboard';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import { DemoProvider, useDemoContext } from './context/DemoContext';

function AppContent() {
  const { isDemoPlaying } = useDemoContext();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen">
      {/* Star warp background (Lenis + gradient + twinkling stars) */}
      <StarBackground />

      {/* Navbar: Landing has its own nav; other routes use MagicalNavbar */}
      <AnimatePresence>
        {!isDemoPlaying && !isLanding && <MagicalNavbar />}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-0 relative z-10 transition-all duration-300">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/security" element={<Security />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/live-api" element={<LiveAPI />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/walkthrough" element={<Walkthrough />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
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
