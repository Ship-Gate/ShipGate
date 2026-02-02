import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Shield, Zap } from 'lucide-react';
import TrustScore from '../components/TrustScore';

interface Issue {
  line: number;
  severity: 'critical' | 'warning';
  message: string;
}

interface ComparisonData {
  regularAI: {
    code: string;
    issues: Issue[];
    trustScore: number;
  };
  intentOS: {
    code: string;
    issues: Issue[];
    trustScore: number;
  };
}

const DOMAINS = [
  { id: 'auth', label: 'Authentication', icon: Shield },
  { id: 'payments', label: 'Payments', icon: Zap },
];

export default function Comparison() {
  const [selectedDomain, setSelectedDomain] = useState('auth');
  const [data, setData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadComparison();
  }, [selectedDomain]);

  const loadComparison = async () => {
    setIsLoading(true);
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: selectedDomain }),
    });
    const data = await res.json();
    setData(data);
    setIsLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-800" data-testid="comparison-title">
          Security Comparison
        </h1>
        <p className="text-gray-500">
          Regular AI vs ISL Studio - see the security difference
        </p>
      </div>

      {/* Domain Selector */}
      <div className="flex gap-3 mb-8">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            onClick={() => setSelectedDomain(domain.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              selectedDomain === domain.id
                ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            data-testid={`domain-${domain.id}`}
          >
            <domain.icon size={18} />
            <span>{domain.label}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading comparison...</div>
      ) : data ? (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Regular AI */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card overflow-hidden border-red-300"
            data-testid="regular-ai-panel"
          >
            <div className="bg-red-50 px-4 py-3 border-b border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={18} />
                  <span className="font-semibold text-red-600">Regular AI</span>
                </div>
                <TrustScore score={data.regularAI.trustScore} size="sm" showLabel={false} />
              </div>
            </div>
            
            <div className="p-4 bg-gray-50">
              <pre className="text-sm font-mono overflow-x-auto">
                {data.regularAI.code.split('\n').map((line, i) => {
                  const issue = data.regularAI.issues.find((iss) => iss.line === i + 1);
                  return (
                    <div
                      key={i}
                      className={`flex ${
                        issue
                          ? issue.severity === 'critical'
                            ? 'bg-red-100'
                            : 'bg-amber-100'
                          : ''
                      }`}
                    >
                      <span className="w-8 text-gray-400 text-right pr-3 select-none">
                        {i + 1}
                      </span>
                      <span className={issue ? 'text-red-700' : 'text-gray-700'}>
                        {line}
                      </span>
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* Issues List */}
            <div className="border-t border-gray-200 p-4">
              <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} />
                {data.regularAI.issues.length} Security Issues Found
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.regularAI.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`text-sm p-2 rounded ${
                      issue.severity === 'critical'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                    data-testid={`issue-${i}`}
                  >
                    <span className="font-mono text-xs mr-2">Line {issue.line}:</span>
                    {issue.message}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ISL Studio */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card overflow-hidden border-green-300"
            data-testid="isl-studio-panel"
          >
            <div className="bg-green-50 px-4 py-3 border-b border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-500" size={18} />
                  <span className="font-semibold text-green-600">ISL Studio Verified</span>
                </div>
                <TrustScore score={data.intentOS.trustScore} size="sm" showLabel={false} />
              </div>
            </div>
            
            <div className="p-4 bg-gray-50">
              <pre className="text-sm font-mono overflow-x-auto">
                {data.intentOS.code.split('\n').map((line, i) => (
                  <div key={i} className="flex">
                    <span className="w-8 text-gray-400 text-right pr-3 select-none">
                      {i + 1}
                    </span>
                    <span className="text-gray-700">{line}</span>
                  </div>
                ))}
              </pre>
            </div>

            {/* Security Features */}
            <div className="border-t border-gray-200 p-4">
              <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                <CheckCircle size={14} />
                Security Features Enforced
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Input Validation',
                  'Type Safety',
                  'Error Handling',
                  'Rate Limiting',
                  'Password Hashing',
                  'Audit Logging',
                  'Sensitive Data Masking',
                  'Session Management',
                ].slice(0, selectedDomain === 'payments' ? 8 : 6).map((feature, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-2 py-1.5 rounded"
                    data-testid={`feature-${i}`}
                  >
                    <CheckCircle size={12} />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Summary Stats */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 grid md:grid-cols-3 gap-6"
        >
          <div className="glass-card p-6 text-center">
            <p className="text-4xl font-bold text-red-500" data-testid="issues-found">
              {data.regularAI.issues.length}
            </p>
            <p className="text-gray-500 mt-1">Security Issues in Regular AI</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-4xl font-bold text-green-500" data-testid="issues-fixed">
              {data.regularAI.issues.length}
            </p>
            <p className="text-gray-500 mt-1">Issues Fixed by ISL Studio</p>
          </div>
          <div className="glass-card p-6 text-center">
            <p className="text-4xl font-bold text-cyan-500" data-testid="score-improvement">
              +{data.intentOS.trustScore - data.regularAI.trustScore}%
            </p>
            <p className="text-gray-500 mt-1">Trust Score Improvement</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
