'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const PRO_FEATURES = [
  'Full dashboard access',
  'Unlimited verifications',
  'Signed proof bundles',
  'Compliance reports',
  'Proof badge',
  'Priority support',
];

const ENTERPRISE_FEATURES = [
  'Everything in Pro',
  'SSO / SAML',
  'RBAC & team roles',
  'Audit log & export',
  'API access',
  'Self-hosted deployment',
  'Proof chains',
];

function CheckoutContent() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'payment_pending') setError('Payment is still processing. Please wait.');
    else if (err === 'verify_failed') setError('Verification failed. Please try again.');
    else if (err === 'invalid') setError('Invalid session. Please try checking out again.');
  }, [searchParams]);

  async function handleCheckout(plan: 'pro' | 'enterprise') {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Checkout not configured. Add STRIPE_SECRET_KEY to .env.local');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('No checkout URL returned');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <div className="text-center mb-10">
        <img
          src="/logo.png"
          alt="ShipGate"
          className="w-16 h-16 rounded-[10px] mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-sg-text0 mb-2">Choose your plan</h1>
        <p className="text-sg-text2 text-sm">
          Unlock the ShipGate dashboard and verification tools.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pro */}
        <div className="relative bg-sg-bg2 border-2 border-sg-ship rounded-xl p-6 flex flex-col">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sg-ship text-sg-bg0 text-xs font-semibold px-3 py-0.5 rounded-full">
            Most Popular
          </span>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sg-text0 font-semibold text-lg">Pro</span>
            <span className="text-sg-ship font-bold text-xl">$49<span className="text-sm font-normal text-sg-text2">/mo</span></span>
          </div>
          <ul className="space-y-2 text-sm text-sg-text2 mb-6 flex-1">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-sg-ship">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleCheckout('pro')}
            disabled={loadingPlan !== null}
            className="w-full py-3 px-4 rounded-lg bg-sg-ship text-sg-bg0 font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPlan === 'pro' ? 'Redirecting…' : 'Get Pro'}
          </button>
        </div>

        {/* Enterprise */}
        <div className="bg-sg-bg2 border border-sg-border rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sg-text0 font-semibold text-lg">Enterprise</span>
            <span className="text-sg-text0 font-bold text-xl">$149<span className="text-sm font-normal text-sg-text2">/mo</span></span>
          </div>
          <ul className="space-y-2 text-sm text-sg-text2 mb-6 flex-1">
            {ENTERPRISE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-sg-ship">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => handleCheckout('enterprise')}
            disabled={loadingPlan !== null}
            className="w-full py-3 px-4 rounded-lg bg-sg-text0 text-sg-bg0 font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPlan === 'enterprise' ? 'Redirecting…' : 'Get Enterprise'}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-sg-text3 mt-6">
        Secure payment powered by Stripe. Cancel anytime.{' '}
        <a href="mailto:founder@shipgate.dev" className="text-sg-ship hover:underline">
          Need custom pricing?
        </a>
      </p>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <Suspense>
          <CheckoutContent />
        </Suspense>
      </div>
    </main>
  );
}
