import { useNavigate } from 'react-router-dom';
import { Workflow, Server, GitCompare, PlayCircle, Shield, Zap, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import GlowCard from '../components/GlowCard';

const features = [
  {
    icon: Shield,
    title: 'Contract-First',
    description: 'Define behaviors before implementation. ISL contracts specify what code should do.',
    color: 'cyan',
  },
  {
    icon: Zap,
    title: 'AI-Powered',
    description: 'AI generates implementations that satisfy your ISL contracts automatically.',
    color: 'purple',
  },
  {
    icon: CheckCircle,
    title: 'Verified',
    description: 'Every behavior is verified. Trust scores give you confidence in generated code.',
    color: 'green',
  },
];

const demos = [
  {
    path: '/pipeline',
    icon: Workflow,
    title: 'Pipeline Demo',
    description: 'Watch intent transform into verified code step-by-step',
    color: 'cyan',
    badge: 'Interactive',
  },
  {
    path: '/live-api',
    icon: Server,
    title: 'Live API Demo',
    description: 'See contract verification on real API calls',
    color: 'green',
    badge: 'Real-time',
  },
  {
    path: '/comparison',
    icon: GitCompare,
    title: 'Comparison',
    description: 'Regular AI vs ISL Studio side-by-side',
    color: 'amber',
    badge: 'Security',
  },
  {
    path: '/walkthrough',
    icon: PlayCircle,
    title: 'Full Walkthrough',
    description: 'Guided tour of all features',
    color: 'purple',
    badge: 'Video',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-7xl md:text-8xl font-bold mb-8 tracking-tight" data-testid="hero-title">
          <span className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">AI Code.</span>
          <br />
          <span className="text-gray-800">Verified.</span>
        </h1>
        <div className="flex gap-4 justify-center">
          <button 
            onClick={() => navigate('/pipeline')}
            className="btn-primary" 
            data-testid="cta-try-demo"
          >
            Try the Demo
          </button>
          <button 
            onClick={() => navigate('/walkthrough')}
            className="btn-secondary" 
            data-testid="cta-watch-tour"
          >
            Watch the Tour
          </button>
        </div>
      </motion.div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {features.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <GlowCard className={feature.color}>
              <div className="glow-card-icon">
                <feature.icon className="w-10 h-10 text-cyan-500 mb-4" />
              </div>
              <h3 className="glow-card-title text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500">{feature.description}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Demo Cards */}
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800" data-testid="demos-section">
        Explore the Demos
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        {demos.map((demo, i) => (
          <motion.div
            key={demo.path}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <GlowCard
              className={demo.color}
              onClick={() => navigate(demo.path)}
              badge={demo.badge}
              data-testid={`demo-card-${demo.path.slice(1)}`}
            >
              <div className="flex items-start gap-4">
                <div className="glow-card-icon p-3 rounded-lg bg-gray-100">
                  <demo.icon className="w-6 h-6 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h3 className="glow-card-title text-lg mb-1">{demo.title}</h3>
                  <p className="text-sm text-gray-500">{demo.description}</p>
                </div>
              </div>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Trust Score Preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 text-center"
      >
        <GlowCard className="cyan inline-block">
          <div className="text-center px-8 py-4">
            <p className="text-sm text-gray-500 mb-2">Average Trust Score</p>
            <div className="text-6xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent" data-testid="trust-score-preview">
              94%
            </div>
            <p className="text-sm text-gray-500 mt-2">Across all verified contracts</p>
          </div>
        </GlowCard>
      </motion.div>
    </div>
  );
}
