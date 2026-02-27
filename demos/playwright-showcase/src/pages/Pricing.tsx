import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { PRICING_PLANS, PRICING_FAQ, CONTACT_EMAIL } from '../data/pricing';
import '../components/ContentCard.css';

const API_BASE = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : '';

async function createCheckoutSession(): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'pro' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Checkout unavailable');
  }
  return res.json() as Promise<{ url: string }>;
}

export default function Pricing() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const { url } = await createCheckoutSession();
      if (url) window.location.href = url;
      else setCheckoutError('No checkout URL returned.');
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4 text-center">
        <motion.h1
          className="section-heading mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Pricing
        </motion.h1>
        <motion.p
          className="text-white/80 mb-16 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          Free for everyone. Pay for governance.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-6">
          {PRICING_PLANS.map(({ id, icon: Icon, name, price, period, tagline, features, cta, highlighted }, i) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
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
              <div className="relative z-10 mt-6">
                {id === 'free' && (
                  <Link
                    to="/walkthrough"
                    className={`block w-full py-3 rounded-xl font-semibold text-center soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''}`}
                  >
                    {cta}
                  </Link>
                )}
                {id === 'pro' && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartTrial}
                      disabled={checkoutLoading}
                      className={`w-full py-3 rounded-xl font-semibold soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {checkoutLoading ? 'Redirecting…' : cta}
                    </button>
                    {checkoutError && (
                      <p className="mt-2 text-sm text-red-300" role="alert">
                        {checkoutError}
                      </p>
                    )}
                  </>
                )}
                {id === 'enterprise' && (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=Shipgate%20Enterprise%20inquiry`}
                    className={`block w-full py-3 rounded-xl font-semibold text-center soft-card__btn ${highlighted ? '!bg-gradient-to-r !from-cyan-500 !to-purple-500 !text-white hover:!from-cyan-400 hover:!to-purple-400 !shadow-none' : ''}`}
                  >
                    {cta}
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.section
          className="mt-24 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="section-heading mb-8">FAQ</h2>
          <div className="space-y-4">
            {PRICING_FAQ.map(({ q, a }, i) => (
              <motion.div
                key={q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i }}
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
      </div>
    </div>
  );
}
