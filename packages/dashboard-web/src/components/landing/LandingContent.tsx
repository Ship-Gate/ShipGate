'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { CheckCircle2, ChevronDown, Terminal, Shield, GitBranch, Ghost, Skull, KeyRound, LayoutDashboard } from 'lucide-react';
import LogoCarousel from '@/components/landing/LogoCarousel';
import GalaxyShader from '@/components/landing/GalaxyShader';
import SmokeProblemBackground from '@/components/landing/SmokeProblemBackground';
import ProblemBox from '@/components/landing/ProblemBox';
import SolutionSection from '@/components/landing/SolutionSection';
import TerminalDemo from '@/components/landing/TerminalDemo';
import SocialProof from '@/components/landing/SocialProof';
import ShipgateFooter from '@/components/landing/ShipgateFooter';
import { PRICING_PLANS, PRICING_FAQ as FAQ_ITEMS } from '@/data/pricing';

/* ---------- 3-step How It Works ---------- */
const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: Terminal,
    title: 'npx shipgate init',
    body: 'Auto-generates behavioral specs from your codebase. Detects your stack and creates ISL contracts in seconds.',
    code: '$ npx shipgate init\n  ✓ Detected: Next.js + TypeScript\n  ✓ Generated 12 behavioral specs',
  },
  {
    step: 2,
    icon: Shield,
    title: 'npx shipgate verify',
    body: 'Catches fake features, hallucinated APIs, and security blind spots. Every violation gets evidence.',
    code: '$ npx shipgate verify\n  ✗ FAKE FEATURE  payments.ts:42\n  ✗ HALLUCINATED API  auth.ts:18\n  Verdict: NO_SHIP ✗',
  },
  {
    step: 3,
    icon: GitBranch,
    title: 'Add to CI',
    body: 'Blocks broken code from shipping. Only verified commits reach production. One YAML line.',
    code: '# .github/workflows/ci.yml\n- run: npx shipgate verify\n  # NO_SHIP → PR blocked',
  },
];

/* ---------- 3 AI Bugs ---------- */
const AI_BUGS = [
  {
    icon: Ghost,
    title: 'Fake Features',
    description: 'Code compiles, passes linting, does absolutely nothing. Exported functions with empty bodies that look real.',
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
  },
  {
    icon: Skull,
    title: 'Hallucinated APIs',
    description: "Calls functions that don't exist. AI invents plausible-sounding methods that aren't in any SDK.",
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
  },
  {
    icon: KeyRound,
    title: 'Security Blind Spots',
    description: 'Plaintext passwords, missing auth checks, unsafe defaults. The bugs auditors find six months later.',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
  },
];

/* ========== Demo Showcase Section ========== */
function DemoShowcaseSection() {
  return (
    <motion.section
      id="demo"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="relative mt-32 max-w-6xl mx-auto px-4 scroll-mt-28"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">
        Mission Control
      </h2>
      <p className="text-white/80 text-center mb-12 max-w-2xl mx-auto">
        The Shipgate VS Code sidebar at a glance. Scan status, intent drift, GitHub, and firewall — all in one place.
      </p>

      <div className="soft-card p-8 flex flex-col md:flex-row items-center gap-8">
        <div className="relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
              <LayoutDashboard className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-semibold text-white">Try the interactive demo</h3>
          </div>
          <p className="text-white/75 text-sm mb-6">
            Toggle scan phases (Idle, SHIP, WARN, NO_SHIP), firewall state, and GitHub connection. See the sidebar respond in real time — no install required.
          </p>
          <a
            href="/demo-preview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all soft-card__btn"
          >
            Open demo
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </motion.section>
  );
}

/* ========== How It Works Section ========== */
function HowItWorksSection() {
  return (
    <motion.section
      id="how-it-works"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="relative mt-32 max-w-6xl mx-auto px-4 scroll-mt-28"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">
        How it works
      </h2>
      <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">
        Three commands. Zero broken deploys.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {HOW_IT_WORKS_STEPS.map(({ step, icon: Icon, title, body, code }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.12 * i }}
            className="soft-card p-6 flex flex-col"
          >
            <div className="relative z-10 flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {step}
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center soft-card__icon-pill">
                <Icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
            </div>

            <h3 className="relative z-10 text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="relative z-10 text-sm text-white/75 mb-4 flex-1">{body}</p>

            <div className="relative z-10 rounded-lg bg-black/50 border border-white/10 p-3 font-mono text-xs leading-relaxed">
              {code.split('\n').map((line, li) => (
                <div key={li} className={getCodeLineColor(line)}>
                  {line}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="hidden md:block absolute top-1/2 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 -translate-y-1/2 pointer-events-none" />
    </motion.section>
  );
}

function getCodeLineColor(line: string): string {
  if (line.startsWith('$') || line.startsWith('#')) return 'text-white/90';
  if (line.includes('✓')) return 'text-emerald-400';
  if (line.includes('✗')) return 'text-red-400';
  if (line.startsWith('  #')) return 'text-white/40';
  if (line.startsWith('- run:')) return 'text-cyan-400';
  return 'text-white/60';
}

/* ========== Pricing Section ========== */
function PricingSection() {
  return (
    <motion.section
      id="pricing"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="mt-32 max-w-5xl mx-auto scroll-mt-28 px-4"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">
        Pricing
      </h2>
      <p className="text-white/80 text-center mb-16 max-w-2xl mx-auto">
        Free to start. Scale when you need to.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        {PRICING_PLANS.map(({ icon: Icon, name, price, period, tagline, features, cta, ctaAction, highlighted }, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 * i }}
            className={`soft-card p-6 text-center flex flex-col ${highlighted ? 'md:scale-105 ring-1 ring-cyan-500/30' : ''}`}
          >
            <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-4 flex items-center justify-center soft-card__icon-pill">
              <Icon className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h3 className="relative z-10 text-lg font-semibold text-white">{name}</h3>
            <p className="relative z-10 text-sm mt-1 text-white/80">{tagline}</p>
            <div className="relative z-10 mt-4 flex items-baseline justify-center gap-1">
              {price === '—' ? (
                <span className="text-2xl font-bold text-white">{period}</span>
              ) : (
                <>
                  <span className="text-3xl font-bold text-white">${price}</span>
                  <span className="text-white/80">{period}</span>
                </>
              )}
            </div>
            <ul className="relative z-10 mt-6 space-y-2 text-left flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/90">
                  <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <PricingCTA action={ctaAction} label={cta} highlighted={highlighted} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function PricingCTA({ action, label, highlighted }: { action: string; label: string; highlighted: boolean }) {
  const baseClass = `relative z-10 mt-6 block w-full py-3 text-center soft-card__btn ${
    highlighted
      ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none'
      : ''
  }`;

  if (action === 'contact') {
    return (
      <a href="mailto:team@shipgate.dev?subject=Shipgate%20Enterprise" className={baseClass}>
        {label}
      </a>
    );
  }

  if (action === 'install') {
    return (
      <a href="#terminal-demo" className={baseClass}>
        {label}
      </a>
    );
  }

  return (
    <a href="#pricing" className={baseClass}>
      {label}
    </a>
  );
}

/* ========== FAQ Section ========== */
function FAQSection() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <motion.section
      id="faq"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="mt-32 max-w-2xl mx-auto scroll-mt-28 px-4"
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
  );
}

/* ========== Landing Page ========== */
export default function LandingContent() {
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

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* ═══════ Hero Section ═══════ */}
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

      {/* ═══════ Problem: The 3 AI Bugs ═══════ */}
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
        <div className="relative z-10 w-full max-w-4xl flex flex-col items-center justify-center text-center problem-content">
          <h2 className="section-heading mb-4">
            The 3 AI Bugs
          </h2>
          <p className="text-white/80 mb-12 text-lg max-w-2xl mx-auto">
            AI-generated code passes compilation, linting, and PR review. But these bugs still ship to production.
          </p>

          <div className="grid sm:grid-cols-3 gap-6 w-full max-w-4xl">
            {AI_BUGS.map(({ icon: Icon, title, description, color, borderColor }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
              >
                <ProblemBox className="h-full text-left">
                  <div className={`w-10 h-10 rounded-xl ${borderColor} border flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <h3 className={`text-lg font-semibold ${color} mb-2`}>{title}</h3>
                  <p className="text-white/75 text-sm leading-relaxed">{description}</p>
                </ProblemBox>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-10 text-white/60 text-sm"
          >
            TypeScript can&apos;t catch these. ESLint can&apos;t catch these. Copilot review can&apos;t catch these.
          </motion.p>
        </div>
      </section>

      {/* ═══════ Main Content Sections ═══════ */}
      <div className="max-w-6xl mx-auto text-center">

        <SolutionSection />

        <HowItWorksSection />

        <DemoShowcaseSection />

        <TerminalDemo />

        <SocialProof />

        <PricingSection />

        <FAQSection />

        <ShipgateFooter />
      </div>
    </div>
  );
}
