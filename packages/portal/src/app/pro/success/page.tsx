'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session found. Please try again.');
      return;
    }

    fetch(`/api/success?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setStatus('error');
          setError(data.error);
          return;
        }
        setStatus('success');
        setEmail(data.email);
        setToken(data.token);
      })
      .catch(() => {
        setStatus('error');
        setError('Failed to verify payment. Please contact support.');
      });
  }, [sessionId]);

  const activateInVSCode = () => {
    setRedirecting(true);
    const uri = `vscode://shipgate.shipgate-isl/activate?token=${encodeURIComponent(token)}`;
    window.location.href = uri;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-sg-blue border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sg-text2">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">&#x274C;</div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sg-text2 mb-6">{error}</p>
          <a
            href="/pro"
            className="inline-block px-6 py-3 rounded-lg bg-sg-blue text-white font-semibold hover:bg-sg-blue/90 transition-colors"
          >
            Try Again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">&#x1F389;</div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Shipgate Pro!</h1>
        <p className="text-sg-text2 mb-2">
          Payment confirmed for <strong className="text-sg-text1">{email}</strong>
        </p>
        <p className="text-sg-text2 mb-8">
          Click below to activate Pro in VS Code. This will open your editor and unlock all AI features.
        </p>

        <button
          onClick={activateInVSCode}
          className="w-full px-6 py-4 rounded-xl bg-sg-blue hover:bg-sg-blue/90 text-white font-bold text-lg transition-colors mb-4"
        >
          {redirecting ? 'Opening VS Code...' : 'Activate in VS Code'}
        </button>

        <div className="mt-6 p-4 rounded-xl bg-sg-card border border-sg-border text-left">
          <p className="text-sg-text3 text-xs mb-2 uppercase tracking-wider font-medium">
            Manual activation
          </p>
          <p className="text-sg-text2 text-sm mb-2">
            If the button doesn&apos;t work, copy this token and paste it in VS Code
            via <code className="text-sg-blue text-xs">Cmd+Shift+P &gt; Shipgate: Activate Pro</code>:
          </p>
          <div className="relative">
            <input
              readOnly
              value={token}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg border border-sg-border text-sg-text1 text-xs font-mono pr-16"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(token); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-sg-border/50 text-sg-text2 text-xs hover:text-sg-text1 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <p className="text-sg-text3 text-xs mt-6">
          Your license never expires. AI Heal and Intent Builder are now unlocked.
        </p>
      </div>
    </div>
  );
}
