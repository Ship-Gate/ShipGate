import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, XCircle, AlertTriangle, Ghost, ChevronDown, Code2, GitCommit, FlaskConical, FileCheck, Tag, Lock } from 'lucide-react';
import Walkthrough from './Walkthrough';
import LogoCarousel from '../components/LogoCarousel';
import ContentCard from '../components/ContentCard';
import RocketTrail from '../components/RocketTrail';
import GalaxyShader from '../components/GalaxyShader';
import SmokeProblemBackground from '../components/SmokeProblemBackground';
import ProblemBox from '../components/ProblemBox';
import '../components/ContentCard.css';
import { unlockAudioContext } from '../utils/audio';
import { PRICING_PLANS as SHARED_PLANS, PRICING_FAQ as FAQ_ITEMS } from '../data/pricing';

const HOW_IT_WORKS_STEPS = [
  { icon: Code2, title: 'AI generates code', body: 'Cursor/Copilot writes features. Compiles clean, passes basic tests.' },
  { icon: GitCommit, title: 'Commit triggers validation', body: 'Pre-commit hook or CI job runs VibeCheck scan.' },
  { icon: FlaskConical, title: 'Reality Mode tests behavior', body: 'Playwright executes the code. Checks if it actually works as claimed.' },
  { icon: FileCheck, title: 'ISL verifies intent', body: 'Validates against behavior contracts. Checks preconditions, side effects, edge cases.' },
  { icon: Tag, title: 'Shipgate decides', body: 'NO_SHIP blocks hallucinations. SHIP passes verified code.' },
  { icon: Lock, title: 'Deploy or block', body: 'Only validated commits reach production. Broken AI code never ships.' },
];

const FEATURES = [
  {
    icon: CheckCircle2,
    title: 'Precondition checks',
    body: 'Blocks debits without balance checks or amount validation.',
    color: 'text-red-600',
    bg: 'from-red-500/10 to-orange-500/10',
  },
  {
    icon: Ghost,
    title: 'Ghost behavior',
    body: 'Flags code with no ISL spec—untested behavior.',
    color: 'text-amber-600',
    bg: 'from-amber-500/10 to-yellow-500/10',
  },
  {
    icon: AlertTriangle,
    title: 'Intent violations',
    body: 'Implementation must match declared intent.',
    color: 'text-purple-600',
    bg: 'from-purple-500/10 to-pink-500/10',
  },
  {
    icon: XCircle,
    title: 'NO_SHIP verdict',
    body: 'One gate result. Blocked until fixed. No exceptions.',
    color: 'text-cyan-600',
    bg: 'from-cyan-500/10 to-blue-500/10',
  },
];

const PRICING_PLANS = SHARED_PLANS;

function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <motion.section
      id="how-it-works"
      ref={sectionRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: false, margin: '-100px' }}
      className="relative mt-32 min-h-[3200px] scroll-mt-28"
    >
      {/* Rocket trail with canvas particle fire */}
      <RocketTrail sectionRef={sectionRef} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 overflow-visible">
        <h2 className="section-heading mx-auto mb-4 text-center">
          How it works
        </h2>
        <p className="text-white/80 text-center mb-24 max-w-2xl mx-auto">
          AI ships fast. Shipgate ensures it ships right.
        </p>

        {/* Staggered steps: left / right with soft-card (match rest of site) */}
        <div className="flex flex-col gap-0 overflow-visible">
          {HOW_IT_WORKS_STEPS.map(({ icon: Icon, title, body }, i) => {
            const isLeft = i % 2 === 0;
            const slideDistance = 140;
            return (
              <div
                key={title}
                className={`min-h-[55vh] flex items-center py-12 overflow-visible ${isLeft ? 'justify-start pl-0 pr-8' : 'justify-end pl-8 pr-0'}`}
              >
                <motion.div
                  initial={{ opacity: 0, x: isLeft ? -slideDistance : slideDistance }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.05, margin: '0px 0px 80px 0px' }}
                  transition={{
                    duration: 0.6,
                    delay: 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="w-full max-w-md shrink-0 soft-card p-6 text-center"
                >
                  <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                    <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <h3 className="relative z-10 text-lg font-semibold text-white">{title}</h3>
                  <p className="relative z-10 text-sm mt-2 text-white/85">{body}</p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

export default function Landing() {
  const [showDemo, setShowDemo] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const problemRef = useRef<HTMLElement>(null);

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroRotateX = useTransform(heroScrollProgress, [0, 0.25, 0.6], [0, 6, 18]);
  const heroTranslateZ = useTransform(heroScrollProgress, [0, 0.3, 0.7], [0, -30, -120]);
  const heroScale = useTransform(heroScrollProgress, [0, 0.5], [1, 0.92]);
  const heroOpacity = useTransform(heroScrollProgress, [0.5, 0.88], [1, 0.15]);

  const { scrollYProgress: problemScrollProgress } = useScroll({
    target: problemRef,
    offset: ['start start', 'end start'],
  });
  const problemBgOpacity = useTransform(problemScrollProgress, [0, 0.2, 0.6, 1], [1, 1, 0.4, 0]);

  const handlePlayDemo = () => {
    unlockAudioContext();
    setShowDemo(true);
  };

  return (
    <div className="min-h-screen">
      {/* Hero section: galaxy shader + 3D parallax content */}
      <section ref={heroRef} className="hero-wrapper hero-wrapper--parallax">
        <div className="absolute inset-0 z-0 w-full h-full min-h-[100vh]" aria-hidden>
          <GalaxyShader />
        </div>
        <div className="hero" aria-hidden />
        <motion.div
          className="hero-content hero-content--3d"
          style={{
            rotateX: heroRotateX,
            z: heroTranslateZ,
            scale: heroScale,
            opacity: heroOpacity,
          }}
        >
          <h1 className="hero-title-stack" data-testid="hero-title">
            <span className="h1--scalingSize" data-text="AI Code.">AI Code.</span>
            <span className="h1--scalingSize" data-text="Verified." style={{ marginTop: '12px', marginBottom: '12px' }}>Verified.</span>
          </h1>
        </motion.div>
        <div className="hero-marquee">
          <LogoCarousel />
        </div>
      </section>

      {/* Problem — full-screen smoke background (opacity fades out on scroll) + box */}
      <section
        ref={problemRef}
        id="problem"
        className="relative w-full min-h-screen overflow-hidden flex flex-col items-center justify-center py-16 px-4 scroll-mt-28"
      >
        <motion.div
          className="absolute inset-0 w-full h-full"
          style={{ opacity: problemBgOpacity }}
        >
          <SmokeProblemBackground />
          <div className="absolute inset-0 bg-black/40 pointer-events-none" aria-hidden />
        </motion.div>
        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center justify-center text-center problem-content">
          <h2 className="section-heading mb-8">
            The Problem
          </h2>
          <ProblemBox className="w-full text-center">
            <p className="text-white/90 mb-8 text-lg">
              Real examples of AI fails that passed PR review:
            </p>
            <ul className="space-y-3 mb-10 text-white/95 font-medium list-none pl-0 mx-auto max-w-lg">
              <li>&ldquo;Auth middleware that compiled but never actually checked tokens&rdquo;</li>
              <li>&ldquo;Stripe integration that silently failed on edge cases&rdquo;</li>
              <li>&ldquo;Form validation that accepted empty strings&rdquo;</li>
            </ul>
            <div className="space-y-5">
              <p className="text-red-300/95 font-semibold flex items-center justify-center gap-2 flex-wrap">
                <span aria-hidden>❌</span>
                AI wrote this. Looked perfect. Shipped to prod. Broke in production.
              </p>
              <p className="text-emerald-300/95 font-semibold flex items-center justify-center gap-2 flex-wrap">
                <span aria-hidden>✅</span>
                VibeCheck caught it in CI. Never reached users.
              </p>
            </div>
          </ProblemBox>
        </div>
      </section>

      {/* Sections */}
      <div className="p-8 max-w-6xl mx-auto text-center">

        {/* How it works - scroll-driven SVG line + text-stroke h2 */}
        <HowItWorksSection />

        {/* What Shipgate catches */}
        <motion.section
          id="what-we-catch"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mt-32 max-w-5xl mx-auto scroll-mt-28"
        >
          <h2 className="section-heading mx-auto mb-4 text-center">
            What we catch
          </h2>
          <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">
            AI code fails these checks before production.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.08 * i }}
                className="flex justify-center"
              >
                <ContentCard
                  compact
                  icon={Icon}
                  title={title}
                  description={body}
                />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Compare table: what catches it */}
        <motion.section
          id="compare"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mt-32 max-w-4xl mx-auto scroll-mt-28"
        >
          <h2 className="section-heading mx-auto mb-4 text-center">
            Compare
          </h2>
          <p className="text-white/80 text-center mb-10 max-w-2xl mx-auto">
            What catches it
          </p>

          <div className="soft-card p-6 md:p-8 overflow-x-auto">
            <table className="relative z-10 w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/15">
                  <th scope="col" className="py-4 px-4 font-semibold text-white/90" />
                  <th scope="col" className="py-4 px-4 font-semibold text-white/90">TypeScript</th>
                  <th scope="col" className="py-4 px-4 font-semibold text-white/90">ESLint</th>
                  <th scope="col" className="py-4 px-4 font-semibold text-white/90">Copilot review</th>
                  <th scope="col" className="py-4 px-0 font-semibold text-cyan-300">ShipGate</th>
                </tr>
              </thead>
              <tbody className="text-white/90">
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 font-medium text-white">Syntax errors</td>
                  <td className="py-3 px-4 text-emerald-400">✅</td>
                  <td className="py-3 px-4 text-emerald-400">✅</td>
                  <td className="py-3 px-4 text-amber-400">⚠️</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">✅</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 font-medium text-white">Type errors</td>
                  <td className="py-3 px-4 text-emerald-400">✅</td>
                  <td className="py-3 px-4 text-amber-400">⚠️</td>
                  <td className="py-3 px-4 text-amber-400">⚠️</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">✅</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 font-medium text-white">Logic bugs</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">✅</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium text-white">Hallucinations</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-red-400/90">❌</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Pricing */}
        <motion.section
          id="pricing"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mt-32 max-w-5xl mx-auto scroll-mt-28"
        >
          <h2 className="section-heading mx-auto mb-4 text-center">
            Pricing
          </h2>
          <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">
            Free for everyone. Pay for governance.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {PRICING_PLANS.map(({ icon: Icon, name, price, period, tagline, features, cta, highlighted }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className={`soft-card p-6 text-center ${highlighted ? 'md:scale-105' : ''}`}
              >
                <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="relative z-10 text-lg font-semibold text-white">{name}</h3>
                <p className="relative z-10 text-sm mt-1 text-white/80">{tagline}</p>
                <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">
                    {price === 'Custom' ? price : `$${price}`}
                  </span>
                  <span className="text-white/80">{period}</span>
                </div>
                <ul className="relative z-10 mt-6 space-y-2 text-left">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/90">
                      <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {name === 'Free' && (
                  <Link
                    to="/walkthrough"
                    className={`relative z-10 mt-6 block w-full py-3 text-center soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''}`}
                  >
                    {cta}
                  </Link>
                )}
                {name === 'Team' && (
                  <Link
                    to="/pricing"
                    className={`relative z-10 mt-6 block w-full py-3 text-center soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''}`}
                  >
                    {cta}
                  </Link>
                )}
                {name === 'Enterprise' && (
                  <a
                    href="mailto:team@shipgate.dev?subject=Shipgate%20Enterprise"
                    className={`relative z-10 mt-6 block w-full py-3 text-center soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''}`}
                  >
                    {cta}
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section
          id="faq"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
          className="mt-32 max-w-2xl mx-auto scroll-mt-28"
        >
          <h2 className="section-heading mx-auto mb-4 text-center">
            FAQ
          </h2>
          <p className="text-white/80 text-center mb-12">
            Common questions about Shipgate.
          </p>

          <div className="space-y-4">
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                className="soft-card"
              >
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="relative z-10 w-full flex items-center justify-between p-5 text-left hover:opacity-90 transition-opacity"
                >
                  <span className="font-medium text-white pr-4">{q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-white/70 shrink-0 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {faqOpen === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative z-10 px-5 pb-5 overflow-hidden"
                    >
                      <p className="text-white/80 text-sm leading-relaxed">{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Full demo — right before CTA */}
        <motion.section
          id="demo"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mt-32 max-w-5xl mx-auto text-center scroll-mt-28"
        >
          {!showDemo ? (
            <div className="flex flex-col items-center gap-4">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                See it in action
              </h2>
              <p className="text-white/80 mb-6">
                Watch the full Shipgate demo — from AI-generated code to verified deploy.
              </p>
              <motion.button
                onClick={handlePlayDemo}
                className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-white/15 text-white text-lg font-semibold border border-white/30 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                data-testid="cta-try-demo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play size={28} fill="currentColor" />
                Play Demo
              </motion.button>
            </div>
          ) : (
            <div className="w-full">
              <Walkthrough autoPlay embedded />
            </div>
          )}
        </motion.section>

        {/* Footer */}
        <footer className="mt-24 py-6 border-t border-white/10 text-center text-white/50 text-xs">
          <span className="font-semibold text-white/70">Shipgate</span> — Powered by ISL. MIT licensed.
        </footer>
      </div>
    </div>
  );
}
