'use client';

import { useEffect } from 'react';

const LANDING_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:5173';

export default function LandingPage() {
  useEffect(() => {
    window.location.href = LANDING_URL;
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting to Shipgate...</p>
    </div>
  );
}
