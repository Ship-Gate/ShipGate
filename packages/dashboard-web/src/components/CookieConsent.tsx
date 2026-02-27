'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShow(false);
  };

  const rejectCookies = () => {
    localStorage.setItem('cookie-consent', 'rejected');
    setShow(false);
  };

  if (!show) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-4 shadow-lg"
    >
      <div className="container mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            We use cookies to enhance your experience, analyze site usage, and assist in our
            marketing efforts. By clicking &quot;Accept&quot;, you consent to our use of cookies.{' '}
            <a href="/privacy" className="underline hover:text-foreground">
              Learn more
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={rejectCookies}>
            Reject
          </Button>
          <Button onClick={acceptCookies}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
