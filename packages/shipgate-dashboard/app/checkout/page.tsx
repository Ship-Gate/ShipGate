'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function CheckoutContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'payment_pending') setError('Payment is still processing. Please wait.');
    else if (err === 'verify_failed') setError('Verification failed. Please try again.');
    else if (err === 'invalid') setError('Invalid session. Please try checking out again.');
  }, [searchParams]);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Checkout not configured. Add STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID to .env.local');
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
      setLoading(false);
    }
  }

  return (
    <>
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="ShipGate"
            className="w-16 h-16 rounded-[10px] mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-sg-text0 mb-2">Upgrade to Pro</h1>
          <p className="text-sg-text2 text-sm">
            The ShipGate dashboard is for Pro members. Subscribe to unlock full access.
          </p>
        </div>

        <div className="bg-sg-bg2 border border-sg-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sg-text0 font-semibold">Pro Plan</span>
            <span className="text-sg-ship font-semibold">$19/mo</span>
          </div>
          <ul className="space-y-2 text-sm text-sg-text2 mb-6">
            <li className="flex items-center gap-2">
              <span className="text-sg-ship">✓</span>
              Full dashboard access
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sg-ship">✓</span>
              Unlimited verifications
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sg-ship">✓</span>
              Priority support
            </li>
            <li className="flex items-center gap-2">
              <span className="text-sg-ship">✓</span>
              Cancel anytime
            </li>
          </ul>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-sg-ship text-sg-bg0 font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redirecting to checkout…' : 'Subscribe with Stripe'}
          </button>
        </div>

        <p className="text-center text-xs text-sg-text3">
          Secure payment powered by Stripe. You can cancel your subscription anytime.
        </p>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Suspense>
          <CheckoutContent />
        </Suspense>
      </div>
    </main>
  );
}
