import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Zap, Users, Building2, ArrowRight } from 'lucide-react';
import { PRICING_PLANS, CONTACT_EMAIL } from '../data/pricing';
import '../components/ContentCard.css';

const API_BASE = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : '';

type PlanId = 'free' | 'team' | 'enterprise';

async function createPortalSession(customerId: string): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/create-portal-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Portal unavailable');
  }
  return res.json() as Promise<{ url: string }>;
}

export default function Dashboard() {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // In a real app, plan and stripeCustomerId come from auth (Clerk) + your backend after Stripe webhook
  const plan: PlanId = 'free';
  const stripeCustomerId: string | null = null;

  const handleManageBilling = async () => {
    if (!stripeCustomerId) {
      setPortalError('No billing account. Subscribe to Team to manage billing.');
      return;
    }
    setPortalError(null);
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession(stripeCustomerId);
      if (url) window.location.href = url;
      else setPortalError('No portal URL returned.');
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPortalLoading(false);
    }
  };

  const planLabel = plan === 'free' ? 'Free' : plan === 'team' ? 'Team' : 'Enterprise';
  const PlanIcon = plan === 'free' ? Zap : plan === 'team' ? Users : Building2;

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-2xl mx-auto px-4">
        <motion.h1
          className="section-heading mb-2 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Account
        </motion.h1>
        <motion.p
          className="text-white/80 mb-10 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          Your plan and billing.
        </motion.p>

        <motion.div
          className="soft-card p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full soft-card__icon-pill flex items-center justify-center">
              <PlanIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Current plan</h2>
              <p className="text-white/80">{planLabel}</p>
            </div>
          </div>
          <ul className="mt-6 space-y-2">
            {PRICING_PLANS.find((p) => p.id === plan)?.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-white/90">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            {stripeCustomerId && (
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl soft-card__btn disabled:opacity-60"
              >
                <CreditCard className="w-4 h-4" />
                {portalLoading ? 'Opening…' : 'Manage billing'}
              </button>
            )}
            {plan === 'free' && (
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl soft-card__btn"
              >
                Upgrade to Team
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          {portalError && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {portalError}
            </p>
          )}
        </motion.div>

        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-white/70 text-sm">
            Enterprise? <a href={`mailto:${CONTACT_EMAIL}?subject=Shipgate%20Enterprise`} className="text-cyan-400 hover:underline">Contact sales</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
