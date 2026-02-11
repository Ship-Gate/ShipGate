'use client';

import dynamic from 'next/dynamic';

const LandingContent = dynamic(() => import('@/components/landing/LandingContent'), {
  ssr: false,
});

export default function LandingPage() {
  return <LandingContent />;
}
