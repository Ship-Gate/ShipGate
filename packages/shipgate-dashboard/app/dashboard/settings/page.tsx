'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Profile = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  isPro: boolean;
  createdAt: string;
  orgs: { id: string; name: string; role: string }[];
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/me')
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed to load')))
      .then((res) => {
        setProfile(res.data);
        setName(res.data.name ?? '');
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save');
        return;
      }
      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, name: data.data.name } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-sg-text0 mb-6">Profile Settings</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-sg-bg2 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-sg-text0 mb-6">Profile Settings</h1>
        <div className="p-4 bg-sg-noship/10 border border-sg-noship/30 rounded-lg text-sg-noship text-sm">
          {error ?? 'Unable to load profile'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors"
      >
        &larr; Back to Dashboard
      </button>

      <h1 className="text-xl font-bold text-sg-text0 mb-6">Profile Settings</h1>

      {/* Avatar + identity */}
      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-sg-bg3 flex items-center justify-center text-xl font-bold text-sg-text1">
              {profile.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <div className="text-lg font-semibold text-sg-text0">{profile.name}</div>
            <div className="text-sm text-sg-text3">{profile.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-sg-text3 capitalize">
                Signed in with {profile.provider}
              </span>
              {profile.isPro && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sg-ship/10 border border-sg-ship/20 text-sg-ship">
                  PRO
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit name */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-sg-text2">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50 transition-colors"
            placeholder="Your name"
          />

          {error && (
            <div className="text-xs text-sg-noship">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || name.trim() === profile.name}
              className="px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-xs text-sg-ship">Saved successfully</span>
            )}
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-sg-text0 mb-4">Account Details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-sg-text3">Email</span>
            <span className="text-sg-text1">{profile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sg-text3">User ID</span>
            <span className="text-sg-text2 font-mono text-xs">{profile.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sg-text3">Provider</span>
            <span className="text-sg-text1 capitalize">{profile.provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sg-text3">Member since</span>
            <span className="text-sg-text1">
              {new Date(profile.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Organizations */}
      {profile.orgs.length > 0 && (
        <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-sg-text0 mb-4">Organizations</h2>
          <div className="space-y-2">
            {profile.orgs.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-sg-bg2/50"
              >
                <span className="text-sm text-sg-text1">{org.name}</span>
                <span className="text-xs text-sg-text3 capitalize">{org.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
