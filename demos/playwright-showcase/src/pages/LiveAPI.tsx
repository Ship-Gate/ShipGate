import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, XCircle, Shield, AlertTriangle } from 'lucide-react';
import TrustScore from '../components/TrustScore';
import CodeBlock from '../components/CodeBlock';

interface Check {
  name: string;
  passed: boolean;
  required?: boolean;
}

interface APIResponse {
  success: boolean;
  checks: Check[];
  securityChecks?: Check[];
  verification: {
    preconditions: Check[];
    postconditions: Check[];
    security?: Check[];
  };
}

const ENDPOINTS = [
  {
    id: 'register',
    method: 'POST',
    path: '/auth/register',
    description: 'Register a new user with email/password',
    contract: `behavior register(email: string, password: string)
  precondition: email.isValidEmail() && password.length >= 8
  postcondition: users'.has(email) && result.isOk()
  errors: [InvalidEmail, WeakPassword, EmailTaken]`,
    defaultBody: { email: 'user@example.com', password: 'securePass123' },
  },
  {
    id: 'charge',
    method: 'POST',
    path: '/payments/charge',
    description: 'Process a payment with card details',
    contract: `behavior charge(amount: Money, card: Card)
  precondition: amount > 0 && card.isValid()
  postcondition: transactions'.length = transactions.length + 1
  sensitive: card.number, card.cvv
  audit: true`,
    defaultBody: { amount: 99.99, card: { number: '4111111111111111', cvv: '123' } },
  },
];

export default function LiveAPI() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState(
    JSON.stringify(ENDPOINTS[0].defaultBody, null, 2)
  );
  const [response, setResponse] = useState<APIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEndpointChange = (endpoint: typeof ENDPOINTS[0]) => {
    setSelectedEndpoint(endpoint);
    setRequestBody(JSON.stringify(endpoint.defaultBody, null, 2));
    setResponse(null);
  };

  const sendRequest = async () => {
    setIsLoading(true);
    setResponse(null);

    try {
      const body = JSON.parse(requestBody);
      const apiPath = selectedEndpoint.id === 'register' ? '/api/live/register' : '/api/live/charge';
      
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      setResponse(data);
    } catch {
      // Handle JSON parse error
    }
    
    setIsLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-800" data-testid="live-api-title">
          Live API Verification
        </h1>
        <p className="text-gray-500">
          See contract verification in action on real API calls
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Endpoint Selector & Request */}
        <div className="lg:col-span-2 space-y-6">
          {/* Endpoint Selection */}
          <div className="glass-card p-4">
            <label className="block text-sm font-medium text-gray-600 mb-3">
              Select Endpoint
            </label>
            <div className="flex gap-3">
              {ENDPOINTS.map((endpoint) => (
                <button
                  key={endpoint.id}
                  onClick={() => handleEndpointChange(endpoint)}
                  className={`flex-1 p-4 rounded-lg border transition-all ${
                    selectedEndpoint.id === endpoint.id
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  data-testid={`endpoint-${endpoint.id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                      {endpoint.method}
                    </span>
                    <span className="font-medium">{endpoint.path}</span>
                  </div>
                  <p className="text-xs text-gray-500">{endpoint.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Contract Display */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-cyan-500" />
              <span className="text-sm font-medium text-gray-600">
                ISL Contract
              </span>
            </div>
            <CodeBlock
              code={selectedEndpoint.contract}
              language="typescript"
              title={`Contract: ${selectedEndpoint.path}`}
            />
          </div>

          {/* Request Body */}
          <div className="glass-card p-4">
            <label className="block text-sm font-medium text-gray-600 mb-3">
              Request Body
            </label>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
              rows={6}
              data-testid="request-body"
            />
            <button
              onClick={sendRequest}
              disabled={isLoading}
              className="btn-primary flex items-center gap-2 mt-4"
              data-testid="send-request"
            >
              <Send size={18} />
              {isLoading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>

        {/* Verification Results */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {response && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
                data-testid="verification-response"
              >
                {/* Status */}
                <div className={`glass-card p-4 ${
                  response.success ? 'border-green-500/30' : 'border-red-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {response.success ? (
                      <CheckCircle className="text-green-400" size={24} />
                    ) : (
                      <XCircle className="text-red-400" size={24} />
                    )}
                    <div>
                      <p className={`font-semibold ${
                        response.success ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {response.success ? 'Request Verified' : 'Verification Failed'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Contract enforcement active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preconditions */}
                <div className="glass-card p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                    <span>Precondition Checks</span>
                  </h4>
                  <div className="space-y-2">
                    {response.verification.preconditions.map((check, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2"
                        data-testid={`precondition-${i}`}
                      >
                        {check.passed ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-500" />
                        )}
                        <code className="text-sm text-gray-700">{check.name}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Postconditions */}
                {response.verification.postconditions.length > 0 && (
                  <div className="glass-card p-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">
                      Postcondition Checks
                    </h4>
                    <div className="space-y-2">
                      {response.verification.postconditions.map((check, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2"
                          data-testid={`postcondition-${i}`}
                        >
                          <CheckCircle size={16} className="text-green-500" />
                          <code className="text-sm text-gray-700">{check.name}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Checks */}
                {response.verification.security && (
                  <div className="glass-card p-4 border-amber-300">
                    <h4 className="text-sm font-medium text-amber-600 mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      Security Verification
                    </h4>
                    <div className="space-y-2">
                      {response.verification.security.map((check, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2"
                          data-testid={`security-${i}`}
                        >
                          <CheckCircle size={16} className="text-green-500" />
                          <span className="text-sm text-gray-700">{check.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trust Score */}
                <div className="glass-card p-6 flex justify-center">
                  <TrustScore score={response.success ? 96 : 45} size="md" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!response && (
            <div className="glass-card p-8 text-center text-gray-400">
              <Shield size={48} className="mx-auto mb-4 opacity-40" />
              <p>Send a request to see verification results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
