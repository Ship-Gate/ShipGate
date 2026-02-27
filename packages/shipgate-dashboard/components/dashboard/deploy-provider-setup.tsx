'use client';

import { useState } from 'react';
import { useDeploymentProviders } from '@/hooks/use-integrations';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/shared/skeleton';
import { Rocket, Copy, Check, Trash2, Plus } from 'lucide-react';

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'vercel') {
    return (
      <svg viewBox="0 0 76 65" className="w-4 h-4" fill="currentColor">
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
      </svg>
    );
  }
  return <Rocket className="w-4 h-4" />;
}

interface SetupResult {
  webhookUrl: string;
  webhookSecret: string;
  provider: string;
}

export function DeployProviderSetup() {
  const { data, isLoading, refetch } = useDeploymentProviders();
  const [showSetup, setShowSetup] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'vercel' | 'railway'>('vercel');
  const [projectFilter, setProjectFilter] = useState('');
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [setting, setSetting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-card" />;
  }

  const providers = data?.providers ?? [];

  async function handleSetup() {
    setSetting(true);
    try {
      const res = await apiClient.post<SetupResult>(
        '/api/v1/integrations/deployments/setup',
        {
          provider: selectedProvider,
          projectFilter: projectFilter || undefined,
        }
      );
      if (res.data) {
        setSetupResult(res.data);
        refetch();
      }
    } finally {
      setSetting(false);
    }
  }

  async function handleDelete(id: string) {
    await apiClient.delete(`/api/v1/integrations/deployments/${id}`);
    refetch();
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-sg-text0">
            Deployment Providers
          </h3>
          <p className="text-[11px] text-sg-text3">
            Receive webhook events from Vercel or Railway.
          </p>
        </div>
        <button
          onClick={() => {
            setShowSetup(!showSetup);
            setSetupResult(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sg-bg3 text-sg-text0 hover:bg-sg-border-hover transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Provider
        </button>
      </div>

      {providers.length > 0 && (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-sg-bg2 border border-sg-border"
            >
              <div className="flex items-center gap-3">
                <div className="text-sg-text1">
                  <ProviderIcon provider={p.provider} />
                </div>
                <div>
                  <span className="text-xs font-medium text-sg-text0 capitalize">
                    {p.provider}
                  </span>
                  {p.projectFilter && (
                    <span className="text-[11px] text-sg-text3 ml-2">
                      filter: {p.projectFilter}
                    </span>
                  )}
                </div>
                <div className="w-2 h-2 rounded-full bg-sg-ship" />
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-1 rounded hover:bg-sg-noship-bg text-sg-text3 hover:text-sg-noship transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showSetup && (
        <div className="border-t border-sg-border pt-4 space-y-3">
          <div className="flex gap-2">
            {(['vercel', 'railway'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  selectedProvider === p
                    ? 'border-sg-accent bg-sg-accent-bg text-sg-text0'
                    : 'border-sg-border bg-sg-bg2 text-sg-text2 hover:text-sg-text0'
                }`}
              >
                <ProviderIcon provider={p} />
                <span className="capitalize">{p}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] text-sg-text3 uppercase tracking-wider block mb-1">
              Project filter (optional)
            </label>
            <input
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="e.g. my-app"
              className="w-full h-8 bg-sg-bg2 border border-sg-border rounded-md px-2 text-xs text-sg-text0 placeholder:text-sg-text3 focus:outline-none focus:border-sg-accent"
            />
          </div>

          <button
            onClick={handleSetup}
            disabled={setting}
            className="px-4 py-2 rounded-lg bg-sg-accent text-white text-xs font-medium hover:bg-sg-accent/80 disabled:opacity-40 transition-colors"
          >
            {setting ? 'Generating...' : 'Generate Webhook'}
          </button>

          {setupResult && (
            <div className="space-y-2 bg-sg-bg2 border border-sg-border rounded-lg p-4">
              <p className="text-xs font-medium text-sg-ship">
                Webhook created. Add these to your {setupResult.provider} project settings:
              </p>
              <div>
                <div className="text-[10px] text-sg-text3 uppercase tracking-wider mb-1">
                  Webhook URL
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-sg-text1 font-mono bg-sg-bg3 px-2 py-1 rounded flex-1 truncate">
                    {setupResult.webhookUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(setupResult.webhookUrl, 'url')}
                    className="p-1 rounded hover:bg-sg-bg3 text-sg-text3"
                  >
                    {copied === 'url' ? (
                      <Check className="w-3.5 h-3.5 text-sg-ship" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-sg-text3 uppercase tracking-wider mb-1">
                  Signing Secret
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-sg-text1 font-mono bg-sg-bg3 px-2 py-1 rounded flex-1 truncate">
                    {setupResult.webhookSecret}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(setupResult.webhookSecret, 'secret')
                    }
                    className="p-1 rounded hover:bg-sg-bg3 text-sg-text3"
                  >
                    {copied === 'secret' ? (
                      <Check className="w-3.5 h-3.5 text-sg-ship" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
