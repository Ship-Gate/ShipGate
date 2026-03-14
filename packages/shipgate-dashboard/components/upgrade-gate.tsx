'use client';

import Link from 'next/link';

interface UpgradeGateProps {
  feature: string;
  description: string;
  requiredPlan: 'pro' | 'enterprise';
  children?: React.ReactNode;
}

const PLAN_INFO = {
  pro: { label: 'Pro', price: '$49/mo', color: 'sg-ship', href: '/checkout?plan=pro' },
  enterprise: { label: 'Enterprise', price: '$149/mo', color: 'purple-500', href: '/checkout?plan=enterprise' },
};

export function UpgradeGate({ feature, description, requiredPlan, children }: UpgradeGateProps) {
  const info = PLAN_INFO[requiredPlan];

  return (
    <div className="relative">
      {children && (
        <div className="opacity-20 pointer-events-none blur-[2px] select-none" aria-hidden="true">
          {children}
        </div>
      )}
      <div className={`${children ? 'absolute inset-0 flex items-center justify-center' : ''}`}>
        <div className="bg-sg-bg1 border border-sg-border rounded-2xl p-8 max-w-md mx-auto text-center shadow-xl">
          <div className={`w-14 h-14 rounded-2xl bg-${info.color}/10 border border-${info.color}/20 flex items-center justify-center mx-auto mb-5`}>
            <svg className={`w-7 h-7 text-${info.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-sg-text0 mb-2">{feature}</h3>
          <p className="text-sm text-sg-text3 mb-6 leading-relaxed">{description}</p>
          <Link
            href={info.href}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-${info.color} text-white font-medium text-sm hover:opacity-90 transition-opacity`}
          >
            Upgrade to {info.label}
            <span className="text-xs opacity-75">{info.price}</span>
          </Link>
          <p className="text-xs text-sg-text3 mt-3">
            {requiredPlan === 'enterprise' ? (
              <>Or <a href="mailto:founder@shipgate.dev" className="text-purple-400 hover:underline">contact sales</a> for custom pricing</>
            ) : (
              <>14-day free trial included</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
