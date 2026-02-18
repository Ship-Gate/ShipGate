'use client';

import { useState } from 'react';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for open source projects',
    features: [
      '✅ Tier 1 Static Provers (7 properties)',
      '✅ CLI with all basic commands',
      '✅ Proof bundle generation',
      '✅ Config file support',
      '✅ Inline suppression comments',
      '✅ JSON + Terminal output',
      '✅ Custom rule API',
      '✅ Pre-commit hook',
    ],
    cta: 'Get Started',
    tier: 'free',
    highlighted: false,
  },
  {
    name: 'Team',
    price: '$99',
    period: 'per year',
    description: 'For teams shipping critical code',
    features: [
      '✅ Everything in Free',
      '✅ Tier 2 Runtime Provers',
      '✅ Tier 3 Adversarial Provers',
      '✅ GitHub Action with PR comments',
      '✅ Proof Bundle History + Trends',
      '✅ Compliance Reports (SOC 2, HIPAA, etc.)',
      '✅ Dashboard (Web UI)',
      '✅ Priority Support',
      '📊 Up to 10 repositories',
    ],
    cta: 'Purchase Team',
    tier: 'team',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$999',
    period: 'per year',
    description: 'For organizations requiring compliance',
    features: [
      '✅ Everything in Team',
      '✅ SSO / SAML Integration',
      '✅ Custom Prover Development',
      '✅ Dedicated Slack Channel',
      '✅ SLA (99.9% Action Uptime)',
      '✅ Audit Export (compliance archives)',
      '✅ On-Premise Deployment',
      '📊 Unlimited repositories',
      '🎯 Dedicated account manager',
    ],
    cta: 'Purchase Enterprise',
    tier: 'enterprise',
    highlighted: false,
  },
];

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (tier: string) => {
    if (tier === 'free') {
      window.location.href = 'https://github.com/isl-verify/isl-verify';
      return;
    }

    if (!email) {
      alert('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Failed to initiate purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Pricing</h1>
          <p className="text-xl text-gray-600 mb-8">
            Choose the plan that fits your needs
          </p>

          <div className="max-w-md mx-auto mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address (for paid plans)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`bg-white rounded-lg shadow-lg p-8 ${
                tier.highlighted ? 'ring-4 ring-indigo-500 transform scale-105' : ''
              }`}
            >
              {tier.highlighted && (
                <div className="bg-indigo-500 text-white text-sm font-bold px-4 py-1 rounded-full inline-block mb-4">
                  MOST POPULAR
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h2>
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                <span className="text-gray-600 ml-2">/ {tier.period}</span>
              </div>
              <p className="text-gray-600 mb-6">{tier.description}</p>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="text-gray-700">
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePurchase(tier.tier)}
                disabled={loading && tier.tier !== 'free'}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  tier.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                {loading && tier.tier !== 'free' ? 'Loading...' : tier.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600">
            Questions? Contact us at{' '}
            <a href="mailto:sales@shipgate.dev" className="text-indigo-600 hover:underline">
              sales@shipgate.dev
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
