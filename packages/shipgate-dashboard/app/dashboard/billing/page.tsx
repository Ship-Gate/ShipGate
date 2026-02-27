'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type LicenseInfo = {
  isPro: boolean;
  scansUsed: number;
  scansLimit: number;
  canScan: boolean;
  email: string;
  createdAt: string;
};

export default function BillingPage() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/me')
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed')))
      .then((res) => {
        setInfo({
          isPro: res.data.isPro,
          scansUsed: res.data.scansUsed,
          scansLimit: res.data.scansLimit,
          canScan: res.data.canScan,
          email: res.data.email,
          createdAt: res.data.createdAt,
        });
      })
      .catch(() => setError('Failed to load billing info'))
      .finally(() => setLoading(false));
  }, []);

  async function openStripePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to open billing portal');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout');
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setError('Failed to start checkout');
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-sg-text0 mb-6">Billing</h1>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-sg-bg2 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const usagePercent = info && info.scansLimit !== Infinity
    ? Math.min((info.scansUsed / info.scansLimit) * 100, 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors"
      >
        &larr; Back to Dashboard
      </button>

      <h1 className="text-xl font-bold text-sg-text0 mb-6">Billing</h1>

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-xs">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sg-text0">Current Plan</h2>
          {info?.isPro ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sg-ship/10 border border-sg-ship/20 text-sg-ship">
              PRO
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sg-bg3 border border-sg-border text-sg-text3">
              FREE
            </span>
          )}
        </div>

        {info?.isPro ? (
          <div className="space-y-4">
            <div className="text-sm text-sg-text2">
              You&apos;re on the <strong className="text-sg-text0">Pro plan</strong> at{' '}
              <strong className="text-sg-text0">$19/month</strong>.
            </div>
            <div className="text-sm text-sg-text2">
              Unlimited scans, full dashboard access, AI-powered commands, and priority support.
            </div>
            <button
              onClick={openStripePortal}
              disabled={portalLoading}
              className="px-4 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sm text-sg-text1 hover:bg-sg-bg3/50 transition-colors disabled:opacity-40"
            >
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-sg-text2">
              You&apos;re on the <strong className="text-sg-text0">Free plan</strong>.
            </div>
            <ul className="space-y-1.5 text-sm text-sg-text3">
              <li className="flex items-center gap-2">
                <span className="text-sg-text3">&#x2022;</span>
                {info?.scansLimit} scans per month
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sg-text3">&#x2022;</span>
                Basic dashboard access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-sg-text3">&#x2022;</span>
                AI commands locked
              </li>
            </ul>
            <button
              onClick={handleUpgrade}
              disabled={portalLoading}
              className="px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
            >
              {portalLoading ? 'Redirecting...' : 'Upgrade to Pro — $19/mo'}
            </button>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-sg-text0 mb-4">Usage This Month</h2>

        {info?.isPro ? (
          <div className="text-sm text-sg-text2">
            Unlimited scans — no usage limits on your Pro plan.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sg-text2">Scans used</span>
              <span className="text-sg-text0 font-medium">
                {info?.scansUsed} / {info?.scansLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-sg-bg3 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usagePercent}%`,
                  backgroundColor: usagePercent >= 90 ? '#ff4d4d' : usagePercent >= 70 ? '#ffaa00' : '#00e68a',
                }}
              />
            </div>
            {!info?.canScan && (
              <div className="text-xs text-sg-noship">
                You&apos;ve reached your monthly scan limit. Upgrade to Pro for unlimited scans.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Billing details */}
      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sg-text0 mb-4">Billing Details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-sg-text3">Billing email</span>
            <span className="text-sg-text1">{info?.email}</span>
          </div>
          {info?.isPro && (
            <div className="flex justify-between">
              <span className="text-sg-text3">Invoices & payment methods</span>
              <button
                onClick={openStripePortal}
                disabled={portalLoading}
                className="text-sg-ship hover:underline text-xs disabled:opacity-40"
              >
                View in Stripe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
