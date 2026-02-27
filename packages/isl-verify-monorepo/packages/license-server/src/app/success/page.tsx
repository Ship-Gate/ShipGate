'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session ID');
      setLoading(false);
      return;
    }

    fetch(`/api/success?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setLicenseKey(data.licenseKey);
        }
      })
      .catch((err) => {
        setError('Failed to retrieve license');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Generating your license...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/pricing"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
          >
            Back to Pricing
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-green-500 text-6xl mb-6 text-center">✅</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
          Payment Successful!
        </h1>
        <p className="text-gray-600 mb-8 text-center">
          Your Shipgate license has been generated. Copy the license key below and activate it using the CLI.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your License Key
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={licenseKey}
              readOnly
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
            />
            <button
              onClick={copyToClipboard}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Activation Instructions</h2>
          <ol className="space-y-2 text-gray-700">
            <li>1. Install Shipgate: <code className="bg-gray-200 px-2 py-1 rounded">npm install -g shipgate</code></li>
            <li>2. Activate your license: <code className="bg-gray-200 px-2 py-1 rounded">shipgate activate &lt;license-key&gt;</code></li>
            <li>3. Verify activation: <code className="bg-gray-200 px-2 py-1 rounded">shipgate license</code></li>
          </ol>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-700 text-sm">
            <strong>Important:</strong> Save this license key in a secure location. You can also use it in CI/CD by setting the <code className="bg-blue-100 px-1 rounded">SHIPGATE_LICENSE</code> environment variable.
          </p>
        </div>

        <div className="text-center">
          <a
            href="https://docs.shipgate.dev"
            className="inline-block bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition mr-4"
          >
            Read Documentation
          </a>
          <a
            href="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
