'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Shield, Zap, Users, Terminal, GitBranch, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ISL_EXAMPLE = `domain UserService {
  behavior RegisterUser {
    input { email: Email, password: String }
    output {
      success: { user: User }
      errors { EMAIL_EXISTS, WEAK_PASSWORD }
    }
    preconditions {
      not User.exists(email)
      input.password.length >= 8
    }
    postconditions {
      success implies User.exists(result.user.id)
    }
    temporal { response within 500ms (p99) }
  }
}`;

const RESULT_EXAMPLE = `✓ SHIP   Trust Score: 94%   Confidence: 100%
  ✓ Preconditions      3/3 passing
  ✓ Postconditions     2/2 passing  
  ✓ Invariants         2/2 holding
  ✓ Error cases        2/2 correct`;

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For individuals exploring behavioral verification.',
    features: [
      'Full CLI (unlimited local runs)',
      'VS Code extension (all features)',
      'ISL language server',
      '50 API gate checks / month',
      'Dashboard (30-day history)',
    ],
    cta: 'Get Started Free',
    href: '/login',
    highlight: false,
    priceId: null,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/ month',
    description: 'For developers who ship AI code to production.',
    features: [
      'Everything in Free',
      'Unlimited API gate checks',
      'Full dashboard history',
      'Proof bundles & audit trail',
      'Compliance reports (SOC 2)',
      'Email alerts on violations',
      'Priority support',
    ],
    cta: 'Start Pro',
    href: null,
    highlight: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  {
    name: 'Team',
    price: '$59',
    period: '/ month',
    description: 'For teams that need shared verification and CI/CD gates.',
    features: [
      'Everything in Pro',
      '5 seats included ($10/seat after)',
      'Multi-user dashboard',
      'GitHub PR gate action',
      'Slack / webhook notifications',
      'SSO (Google Workspace)',
      'SLA + dedicated support',
    ],
    cta: 'Start Team Trial',
    href: null,
    highlight: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID,
  },
];

function PricingCard({ plan, index }: { plan: typeof PLANS[0]; index: number }) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    if (plan.href) {
      window.location.href = plan.href;
      return;
    }
    if (!plan.priceId) {
      window.location.href = '/login';
      return;
    }
    setLoading(true);
    try {
      const token = document.cookie.match(/sg_token=([^;]+)/)?.[1];
      if (!token) {
        window.location.href = `/login?redirect=/pricing`;
        return;
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${window.location.origin}/dashboard?upgraded=1`,
          cancelUrl: `${window.location.origin}/#pricing`,
        }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {
      window.location.href = '/login';
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`relative flex flex-col rounded-2xl border p-8 ${
        plan.highlight
          ? 'border-white/20 bg-white/5 ring-1 ring-white/20 shadow-xl shadow-black/40'
          : 'border-white/8 bg-white/[0.02]'
      }`}
    >
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
            Most popular
          </span>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
        <p className="mt-1 text-sm text-white/50">{plan.description}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">{plan.price}</span>
          <span className="text-sm text-white/40">{plan.period}</span>
        </div>
      </div>
      <ul className="mb-8 flex-1 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm text-white/70">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        onClick={handleCheckout}
        disabled={loading}
        variant={plan.highlight ? 'default' : 'outline'}
        className={`w-full ${plan.highlight ? 'bg-white text-black hover:bg-white/90' : 'border-white/15 text-white hover:bg-white/8'}`}
      >
        {loading ? 'Loading…' : plan.cta}
        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-24 pt-32 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[600px] w-[600px] rounded-full bg-indigo-500/10 blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-4xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            Behavioral verification for AI-generated code
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            AI writes code.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              You define the rules.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50">
            Write behavioral specs in ISL. Shipgate verifies every function, entity, and invariant
            against your implementation — catching violations before they ship.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="/login">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="border-white/15 text-white hover:bg-white/8 px-8">
                See How It Works
              </Button>
            </a>
          </div>
        </motion.div>
      </section>

      {/* Demo */}
      <section id="demo" className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-white/40">
                <Terminal className="h-3.5 w-3.5" />
                specs/user-service.isl
              </div>
              <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-white/80">
                <code>{ISL_EXAMPLE}</code>
              </pre>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
                <div className="mb-3 flex items-center gap-2 text-xs text-white/40">
                  <Terminal className="h-3.5 w-3.5" />
                  shipgate gate specs/user-service.isl --impl src/
                </div>
                <pre className="font-mono text-sm leading-relaxed text-emerald-400">
                  <code>{RESULT_EXAMPLE}</code>
                </pre>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6">
                <div className="mb-3 text-xs text-white/40">Install</div>
                <pre className="font-mono text-sm text-white/70">
                  <code>npm install -g shipgate</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="mt-3 text-white/50">From spec to verified in three steps</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: <Lock className="h-6 w-6 text-indigo-400" />, step: '01', title: 'Write intent specs', body: 'Define what your code must do — preconditions, postconditions, invariants, timing constraints — in ISL. No boilerplate.' },
              { icon: <Zap className="h-6 w-6 text-emerald-400" />, step: '02', title: 'Shipgate verifies', body: 'The gate command generates and runs behavioral tests against your actual implementation. No manual test-writing.' },
              { icon: <GitBranch className="h-6 w-6 text-cyan-400" />, step: '03', title: 'Get a verdict', body: 'SHIP, WARN, or NO-SHIP with a trust score, evidence trail, and per-file breakdown. Block bad AI code in CI.' },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-white/8 bg-white/[0.02] p-6"
              >
                <div className="mb-4 flex items-center justify-between">
                  {s.icon}
                  <span className="font-mono text-4xl font-bold text-white/8">{s.step}</span>
                </div>
                <h3 className="mb-2 font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-white/50">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: <Terminal className="h-5 w-5 text-white/40" />, label: 'VS Code extension', value: 'shipgate-isl' },
              { icon: <Shield className="h-5 w-5 text-white/40" />, label: 'Verification method', value: 'Behavioral contracts' },
              { icon: <Users className="h-5 w-5 text-white/40" />, label: 'Spec language', value: 'ISL (Intent Spec Lang)' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-5">
                {s.icon}
                <div>
                  <div className="text-xs text-white/40">{s.label}</div>
                  <div className="font-semibold text-white">{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-white/50">
              CLI and VS Code extension are always free. Pay for the dashboard and CI/CD gates.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <PricingCard key={plan.name} plan={plan} index={i} />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-white/30">
            No credit card required for Free. Cancel Pro/Team anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-sm text-white/30">
          <span>© 2026 Shipgate. MIT Licensed.</span>
          <div className="flex gap-6">
            <a href="https://github.com/shipgate/shipgate" className="hover:text-white/60 transition-colors">GitHub</a>
            <a href="/contact" className="hover:text-white/60 transition-colors">Contact</a>
            <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
