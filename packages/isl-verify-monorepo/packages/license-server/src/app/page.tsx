'use client';

import { useState } from 'react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            Shipgate
          </h1>
          <p className="text-2xl text-gray-600 mb-8">
            Formal Verification for TypeScript & JavaScript
          </p>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Prove your code is correct before deployment. Catch bugs, security issues, and compliance violations with automated formal verification.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold mb-2">Static Proofs</h3>
            <p className="text-gray-600">
              Tier 1 provers check null safety, bounds, types, error handling, and more
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">Runtime Verification</h3>
            <p className="text-gray-600">
              Tier 2/3 provers validate API contracts, auth, data leakage, and adversarial tests
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-xl font-bold mb-2">Compliance Reports</h3>
            <p className="text-gray-600">
              Generate SOC 2, HIPAA, PCI-DSS, and EU AI Act compliance reports
            </p>
          </div>
        </div>

        <div className="text-center">
          <a
            href="/pricing"
            className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition"
          >
            View Pricing
          </a>
          <a
            href="https://github.com/shipgate/shipgate"
            className="inline-block ml-4 bg-gray-800 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-900 transition"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
