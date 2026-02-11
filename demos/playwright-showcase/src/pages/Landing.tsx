'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  Terminal,
  Shield,
  GitBranch,
  FileJson,
  Monitor,
  Workflow,
  FolderCog,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { gsapStaggerReveal, prefersReducedMotion } from '@/lib/motion';
import SolutionSection from '@/components/SolutionSection';
import TerminalDemo from '@/components/TerminalDemo';
import ShipgateFooter from '@/components/ShipgateFooter';
import { PRICING_PLANS, PRICING_FAQ } from '@/data/pricing';
import '@/components/ContentCard.css';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#integrations', label: 'Integrations' },
  { href: 'https://docs.shipgate.dev', label: 'Docs', external: true },
  { href: '#pricing', label: 'Pricing' },
];

const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    icon: Terminal,
    title: 'shipgate init',
    body: 'Auto-generates truthpack and config. Detects routes, env vars, and creates .shipgate.yml in seconds.',
    code: '$ npx shipgate init\n  ✓ Created .shipgate.yml\n  ✓ Built truthpack from codebase',
  },
  {
    step: 2,
    icon: Shield,
    title: 'shipgate verify',
    body: 'Verifies implementation against ISL specs. Catches ghost routes, intent mismatches, and security violations.',
    code: '$ npx shipgate verify specs/ --impl src/\n  Verdict: NO_SHIP ✗\n  3 violations found',
  },
  {
    step: 3,
    icon: GitBranch,
    title: 'shipgate gate',
    body: 'Deterministic SHIP/NO_SHIP verdict. Blocks broken code from merging. One YAML line in CI.',
    code: '# .github/workflows/shipgate.yml\n- run: npx shipgate gate specs/ --impl src/\n  # NO_SHIP → PR blocked',
  },
];

const INTEGRATIONS = [
  { icon: Monitor, label: 'VS Code', desc: 'Inline diagnostics, gate on save' },
  { icon: Workflow, label: 'GitHub Actions', desc: 'unified-gate.yml, PR comments' },
  { icon: FileJson, label: 'SARIF / JSON', desc: 'Evidence bundles, reports' },
];

const ARTIFACTS = [
  { label: 'Proof bundles', desc: 'Deterministic evidence for every verification' },
  { label: 'Trust scores', desc: '0–100 score per spec/domain' },
  { label: 'HTML reports', desc: 'Human-readable findings + export' },
];

const USE_CASES = [
  { title: 'Platform engineering', desc: 'Gate infrastructure changes against intent' },
  { title: 'Security & compliance', desc: 'PII, auth, rate-limit policy packs' },
  { title: 'AI-assisted dev', desc: 'Verify AI-generated code before merge' },
];

function getCodeLineColor(line: string): string {
  if (line.startsWith('$') || line.startsWith('#')) return 'text-zinc-400';
  if (line.includes('✓')) return 'text-emerald-400';
  if (line.includes('✗')) return 'text-red-400';
  if (line.startsWith('  #')) return 'text-zinc-500';
  if (line.startsWith('- run:')) return 'text-cyan-400';
  return 'text-zinc-400';
}

function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return;
    gsapStaggerReveal(sectionRef.current, '.how-step-card', { y: 24, stagger: 0.12 });
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-24 md:py-32 px-4 scroll-mt-24"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Workflow
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          How it works
        </h2>
        <p className="text-zinc-400 text-lg mb-16 max-w-2xl">
          Three commands. Contracts → verify → gate. Zero broken deploys.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {HOW_IT_WORKS_STEPS.map(({ step, icon: Icon, title, body, code }) => (
            <div
              key={title}
              className="how-step-card rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {step}
                </div>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 mb-4 flex-1">{body}</p>

              <div className="rounded-lg bg-black/60 border border-zinc-800 p-3 font-mono text-xs leading-relaxed">
                {code.split('\n').map((line, li) => (
                  <div key={li} className={getCodeLineColor(line)}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return;
    gsapStaggerReveal(sectionRef.current, '.integration-card', { y: 20, stagger: 0.1 });
  }, []);

  return (
    <section
      id="integrations"
      ref={sectionRef}
      className="py-24 md:py-32 px-4 scroll-mt-24 bg-zinc-950/50"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Integrations
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Fits your workflow
        </h2>
        <p className="text-zinc-400 text-lg mb-16 max-w-2xl">
          CLI, VS Code, GitHub Actions. Evidence output in SARIF and JSON.
        </p>

        <div className="grid sm:grid-cols-3 gap-6">
          {INTEGRATIONS.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="integration-card rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-emerald-400" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-white mb-1">{label}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofArtifactsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return;
    gsapStaggerReveal(sectionRef.current, '.artifact-item', { y: 16, stagger: 0.08 });
  }, []);

  return (
    <section
      id="artifacts"
      ref={sectionRef}
      className="py-24 md:py-32 px-4 scroll-mt-24"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Proof & artifacts
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Deterministic evidence
        </h2>
        <p className="text-zinc-400 text-lg mb-12 max-w-2xl">
          Every verification produces downloadable artifacts. Reports, findings, verdict. No black box.
        </p>

        <div className="grid sm:grid-cols-3 gap-6">
          {ARTIFACTS.map(({ label, desc }) => (
            <div
              key={label}
              className="artifact-item rounded-xl border border-zinc-800 bg-zinc-900/30 p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <FolderCog className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                <h3 className="font-semibold text-white">{label}</h3>
              </div>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return;
    gsapStaggerReveal(sectionRef.current, '.usecase-card', { y: 20, stagger: 0.1 });
  }, []);

  return (
    <section
      id="use-cases"
      ref={sectionRef}
      className="py-24 md:py-32 px-4 scroll-mt-24 bg-zinc-950/50"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Use cases
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Built for teams
        </h2>
        <p className="text-zinc-400 text-lg mb-12 max-w-2xl">
          Platform engineering, security, compliance, AI-assisted development.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {USE_CASES.map(({ title, desc }) => (
            <div
              key={title}
              className="usecase-card rounded-xl border border-zinc-800 bg-zinc-900/30 p-6"
            >
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current || prefersReducedMotion()) return;
    gsapStaggerReveal(sectionRef.current, '.pricing-card', { y: 24, stagger: 0.1 });
  }, []);

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="py-24 md:py-32 px-4 scroll-mt-24"
    >
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Pricing
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Simple pricing
        </h2>
        <p className="text-zinc-400 text-lg mb-16 max-w-2xl">
          Free to start. Open source core. Scale when you need to.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {PRICING_PLANS.map(({ icon: Icon, name, price, period, tagline, features, cta, ctaAction, highlighted }) => (
            <div
              key={name}
              className={`pricing-card rounded-2xl border p-6 flex flex-col ${
                highlighted
                  ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/30'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-emerald-400" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-semibold text-white">{name}</h3>
              <p className="text-sm text-zinc-400 mt-1">{tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                {price === '—' ? (
                  <span className="text-2xl font-bold text-white">{period}</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-white">${price}</span>
                    <span className="text-zinc-400">{period}</span>
                  </>
                )}
              </div>
              <ul className="mt-6 space-y-2 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <PricingCTA action={ctaAction} label={cta} highlighted={highlighted} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCTA({
  action,
  label,
  highlighted,
}: {
  action: string;
  label: string;
  highlighted: boolean;
}) {
  const baseClass =
    'mt-6 block w-full py-3 text-center rounded-lg font-medium transition-colors ' +
    (highlighted
      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500'
      : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700');

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

function FAQSection() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32 px-4 scroll-mt-24 bg-zinc-950/50">
      <div className="max-w-2xl mx-auto">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          FAQ
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
          Common questions
        </h2>
        <p className="text-zinc-400 mb-12">Developer-focused. No fluff.</p>

        <div className="space-y-3">
          {PRICING_FAQ.map(({ q, a }, i) => (
            <div
              key={q}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-800/30 transition-colors"
              >
                <span className="font-medium text-white pr-4">{q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-zinc-500 shrink-0 transition-transform ${
                    faqOpen === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {faqOpen === i && (
                <div className="px-5 pb-5">
                  <p className="text-zinc-400 text-sm leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const heroRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80"
        aria-label="Main"
      >
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-semibold text-white text-lg">
            Shipgate
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label, external }) =>
              external ? (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {label}
                </a>
              ) : (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {label}
                </a>
              )
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="https://github.com/guardiavault-oss/ISL-LANG"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              GitHub
            </Link>
            <a
              href="#terminal-demo"
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-medium text-white hover:from-emerald-400 hover:to-teal-500 transition-all"
            >
              Install
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        ref={heroRef}
        id="hero"
        className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-4 min-h-[85vh] flex flex-col justify-center"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.08) 0%, transparent 50%)`,
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700/50 bg-zinc-900/50 text-zinc-400 text-xs uppercase tracking-wider mb-8">
            <Lock className="w-3.5 h-3.5" />
            Proof-driven code verification
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight mb-6" data-testid="hero-title">
            Stop AI from shipping
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              fake features
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Contracts and intent specs → verify → report → CI/IDE. Enterprise-grade
            verification for AI-generated code.
          </p>

          <ul className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center mb-10 text-sm text-zinc-500">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              Behavioral contracts (ISL)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              SHIP / NO_SHIP verdicts
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              Local-first, no code upload
            </li>
          </ul>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="#terminal-demo"
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3 text-base font-medium text-white hover:from-emerald-400 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              Get Started
            </a>
            <a
              href="https://docs.shipgate.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-white hover:bg-zinc-800/50 transition-colors flex items-center gap-2"
            >
              View Docs
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Solution: ISL + verification */}
      <SolutionSection />

      {/* How it works */}
      <HowItWorksSection />

      {/* Terminal demo */}
      <TerminalDemo />

      {/* Integrations */}
      <IntegrationsSection />

      {/* Proof / Artifacts */}
      <ProofArtifactsSection />

      {/* Use cases */}
      <UseCasesSection />

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Footer */}
      <ShipgateFooter />
    </div>
  );
}
