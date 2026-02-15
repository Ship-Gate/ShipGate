'use client';

import { useState } from 'react';

const features = [
  {
    title: 'AI Heal',
    desc: 'Automatically fix failing code with AI-powered verify → fix → re-verify loops.',
    icon: '⚡',
  },
  {
    title: 'Intent Builder',
    desc: 'Describe what your code should do in plain English. AI generates ISL specs + verified code.',
    icon: '🧠',
  },
  {
    title: 'Manual Heal',
    desc: 'Pick a failing file, write your correct intent, and let AI fix it precisely.',
    icon: '🔧',
  },
  {
    title: 'Priority Support',
    desc: 'Get help directly from the Shipgate team when you need it.',
    icon: '💬',
  },
];

export default function ProPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Hero */}
      <div className="max-w-2xl w-full text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sg-blue/10 border border-sg-blue/20 text-sg-blue text-sm font-medium mb-6">
          <span>✨</span> Shipgate Pro
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Ship with <span className="text-sg-blue">AI confidence</span>
        </h1>

        <p className="text-sg-text2 text-lg leading-relaxed max-w-xl mx-auto">
          Unlock AI-powered healing and intent building. Let AI automatically fix your code
          until it passes behavioral verification.
        </p>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full mb-12">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-5 rounded-xl bg-sg-card border border-sg-border/50 hover:border-sg-blue/30 transition-colors"
          >
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-sg-text1 mb-1">{f.title}</h3>
            <p className="text-sg-text2 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Pricing card */}
      <div className="max-w-md w-full rounded-2xl bg-sg-card border border-sg-border p-8 text-center">
        <div className="mb-6">
          <div className="text-sm text-sg-text2 uppercase tracking-wider font-medium mb-2">
            One-time payment
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-sg-text1">$29</span>
          </div>
          <div className="text-sg-text3 text-sm mt-1">Lifetime access to Pro features</div>
        </div>

        <div className="space-y-3 text-left mb-6">
          {['AI Heal (auto-fix all failing files)', 'Intent Builder (AI spec + code gen)', 'Manual file heal with custom intent', 'Shared AI infrastructure (no API key needed)', 'All future Pro features'].map((item) => (
            <div key={item} className="flex items-start gap-2 text-sm">
              <span className="text-sg-green mt-0.5">✓</span>
              <span className="text-sg-text1">{item}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheckout()}
            className="w-full px-4 py-3 rounded-lg bg-sg-bg border border-sg-border text-sg-text1 placeholder:text-sg-text3 focus:border-sg-blue focus:outline-none transition-colors"
          />

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full px-4 py-3 rounded-lg bg-sg-blue hover:bg-sg-blue/90 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting to checkout…' : 'Get Shipgate Pro — $29'}
          </button>

          {error && (
            <p className="text-sg-red text-sm text-center">{error}</p>
          )}
        </div>

        <p className="text-sg-text3 text-xs mt-4">
          Secure payment via Stripe. You&apos;ll be redirected back to VS Code after purchase.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sg-text3 text-xs">
        <p>Already have Pro? Open VS Code — your license is activated automatically.</p>
      </div>
    </div>
  );
}
