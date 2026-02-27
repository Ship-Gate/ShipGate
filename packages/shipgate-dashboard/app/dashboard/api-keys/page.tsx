'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Token = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type NewToken = Token & { token: string };

export default function ApiKeysPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [justCreated, setJustCreated] = useState<NewToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const router = useRouter();

  const fetchTokens = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/tokens')
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed')))
      .then((res) => setTokens(res.data))
      .catch(() => setError('Failed to load API keys'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  async function handleCreate() {
    if (!newTokenName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTokenName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create token');
        return;
      }
      const data = await res.json();
      setJustCreated(data.data);
      setNewTokenName('');
      setShowCreate(false);
      fetchTokens();
    } catch {
      setError('Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/v1/tokens/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to revoke');
        return;
      }
      setTokens((prev) => prev.filter((t) => t.id !== id));
      if (justCreated?.id === id) setJustCreated(null);
    } catch {
      setError('Failed to revoke token');
    } finally {
      setRevoking(null);
    }
  }

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors"
      >
        &larr; Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-sg-text0">API Keys</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 rounded-lg bg-sg-ship text-sg-bg0 text-xs font-medium hover:opacity-90 transition"
        >
          + New Key
        </button>
      </div>

      <p className="text-sm text-sg-text3 mb-6">
        Personal access tokens let the CLI and VS Code extension authenticate with your account.
        Tokens are shown only once when created.
      </p>

      {/* Just-created token banner */}
      {justCreated && (
        <div className="bg-sg-ship/10 border border-sg-ship/30 rounded-xl p-4 mb-6">
          <div className="text-sm font-medium text-sg-ship mb-2">
            Token created: {justCreated.name}
          </div>
          <div className="text-xs text-sg-text3 mb-2">
            Copy this token now. You won&apos;t be able to see it again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-xs font-mono break-all select-all">
              {justCreated.token}
            </code>
            <button
              onClick={() => copyToken(justCreated.token)}
              className="shrink-0 px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-xs text-sg-text1 hover:bg-sg-bg3/50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4 mb-6">
          <label className="block text-xs font-medium text-sg-text2 mb-2">Token Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g. CLI on MacBook"
              className="flex-1 px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newTokenName.trim()}
              className="px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-xs">
          {error}
        </div>
      )}

      {/* Token list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-sg-bg2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="bg-sg-bg1 border border-sg-border rounded-xl p-8 text-center">
          <div className="text-sg-text3 text-sm mb-2">No API keys yet</div>
          <div className="text-sg-text3 text-xs">
            Create a personal access token to use with the CLI or VS Code extension.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="bg-sg-bg1 border border-sg-border rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium text-sg-text0">{token.name}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-sg-text3">
                  <span className="font-mono">{token.prefix}•••</span>
                  <span>Created {formatDate(token.createdAt)}</span>
                  {token.lastUsedAt && (
                    <span>Last used {formatDate(token.lastUsedAt)}</span>
                  )}
                  {token.expiresAt && (
                    <span>
                      Expires {formatDate(token.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(token.id)}
                disabled={revoking === token.id}
                className="px-3 py-1.5 rounded-lg text-xs text-sg-noship hover:bg-sg-noship/10 transition-colors disabled:opacity-40"
              >
                {revoking === token.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
