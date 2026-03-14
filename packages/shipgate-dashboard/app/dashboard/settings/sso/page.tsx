'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/use-data';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/shared/skeleton';
import { ArrowLeft, Shield, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';

interface SsoConnection {
  clientID: string;
  name?: string;
  idpMetadata?: { provider?: string };
}

interface OrgSsoState {
  ssoEnabled: boolean;
  ssoDomain: string | null;
  ssoEnforced: boolean;
  domainVerified: boolean;
  domainVerifyToken: string | null;
}

export default function SsoSettingsPage() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [orgId, setOrgId] = useState('');
  const [orgSso, setOrgSso] = useState<OrgSsoState | null>(null);
  const [connections, setConnections] = useState<SsoConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Domain
  const [domain, setDomain] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // SAML
  const [metadataUrl, setMetadataUrl] = useState('');
  const [samlSaving, setSamlSaving] = useState(false);

  const adminOrgs = profile?.orgs?.filter((o) => o.role === 'admin') ?? [];

  const loadSsoState = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, connRes] = await Promise.all([
        fetch(`/api/v1/me`, { credentials: 'same-origin' }).then((r) => r.json()),
        apiClient.get<SsoConnection[]>(`/api/v1/sso?orgId=${id}`),
      ]);
      const org = orgRes.data?.orgs?.find((o: { id: string }) => o.id === id);
      if (org) {
        setOrgSso({
          ssoEnabled: org.ssoEnabled ?? false,
          ssoDomain: org.ssoDomain ?? null,
          ssoEnforced: org.ssoEnforced ?? false,
          domainVerified: org.domainVerified ?? false,
          domainVerifyToken: org.domainVerifyToken ?? null,
        });
        setDomain(org.ssoDomain ?? '');
      }
      setConnections((connRes.data as unknown as SsoConnection[]) ?? []);
    } catch {
      setError('Failed to load SSO configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId) loadSsoState(orgId);
  }, [orgId, loadSsoState]);

  useEffect(() => {
    if (adminOrgs.length === 1 && !orgId) {
      setOrgId(adminOrgs[0].id);
    }
  }, [adminOrgs, orgId]);

  async function handleClaimDomain() {
    if (!domain.trim() || !orgId) return;
    setDomainSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiClient.post<{ domain: string; verifyToken: string; instructions: string }>(
        '/api/v1/domains',
        { orgId, domain: domain.trim() }
      );
      setSuccess(res.data?.instructions ?? 'Domain claimed. Add the DNS TXT record to verify.');
      await loadSsoState(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim domain');
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleVerifyDomain() {
    setVerifying(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.post('/api/v1/domains', JSON.parse('{}'));
      const res = await fetch('/api/v1/domains', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Verification failed');
      } else {
        setSuccess('Domain verified successfully.');
        await loadSsoState(orgId);
      }
    } catch {
      setError('Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function handleCreateConnection() {
    if (!metadataUrl.trim() || !orgId) return;
    setSamlSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.post('/api/v1/sso', { orgId, metadataUrl: metadataUrl.trim() });
      setSuccess('SAML connection created.');
      setMetadataUrl('');
      await loadSsoState(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create SAML connection');
    } finally {
      setSamlSaving(false);
    }
  }

  async function handleToggleEnforce() {
    if (!orgId) return;
    setError(null);
    try {
      await fetch('/api/v1/sso', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ssoEnforced: !orgSso?.ssoEnforced }),
        credentials: 'same-origin',
      });
      await loadSsoState(orgId);
    } catch {
      setError('Failed to toggle SSO enforcement');
    }
  }

  async function handleToggleEnabled() {
    if (!orgId) return;
    setError(null);
    try {
      const newEnabled = !orgSso?.ssoEnabled;
      await fetch(`/api/v1/sso?orgId=${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ssoEnabled: newEnabled }),
        credentials: 'same-origin',
      });
      await loadSsoState(orgId);
    } catch {
      setError('Failed to toggle SSO');
    }
  }

  if (profileLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-sg-text0 mb-6">SSO Configuration</h1>
        <Skeleton className="h-32 w-full rounded-lg mb-4" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Settings
      </button>

      <h1 className="text-xl font-bold text-sg-text0 mb-2">SSO Configuration</h1>
      <p className="text-sm text-sg-text3 mb-6">
        Configure SAML SSO for enterprise identity provider integration. Admin only.
      </p>

      {adminOrgs.length > 1 && (
        <div className="mb-6">
          <label className="block text-xs font-medium text-sg-text2 mb-1">Organization</label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
          >
            <option value="">Select organization...</option>
            {adminOrgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-sg-ship/10 border border-sg-ship/30 text-sg-ship text-sm flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : orgId ? (
        <div className="space-y-6">
          {/* Domain verification */}
          <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-sg-text2" />
              <h2 className="text-sm font-semibold text-sg-text0">Email Domain</h2>
            </div>
            <p className="text-xs text-sg-text3 mb-3">
              Claim your corporate email domain to enable SSO for all users with matching emails.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                className="flex-1 px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
              />
              <button
                onClick={handleClaimDomain}
                disabled={domainSaving || !domain.trim()}
                className="px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                {domainSaving ? 'Saving...' : 'Claim'}
              </button>
            </div>
            {orgSso?.ssoDomain && !orgSso.domainVerified && (
              <div className="space-y-2">
                <p className="text-xs text-sg-warn">
                  Domain claimed but not verified. Add a TXT record:
                </p>
                <code className="block text-[11px] bg-sg-bg2 p-2 rounded text-sg-text2 break-all">
                  _shipgate-verify.{orgSso.ssoDomain} → {orgSso.domainVerifyToken}
                </code>
                <button
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="px-3 py-1.5 rounded-lg bg-sg-bg3 text-sg-text0 text-xs font-medium hover:bg-sg-bg2 transition disabled:opacity-40"
                >
                  {verifying ? 'Checking...' : 'Verify DNS'}
                </button>
              </div>
            )}
            {orgSso?.domainVerified && (
              <div className="flex items-center gap-1.5 text-xs text-sg-ship">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {orgSso.ssoDomain} — verified
              </div>
            )}
          </div>

          {/* SAML configuration */}
          <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-sg-text2" />
              <h2 className="text-sm font-semibold text-sg-text0">SAML Configuration</h2>
            </div>

            {connections.length > 0 ? (
              <div className="space-y-2 mb-4">
                {connections.map((conn) => (
                  <div
                    key={conn.clientID}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-sg-bg2 border border-sg-border"
                  >
                    <div>
                      <span className="text-xs font-medium text-sg-text0">
                        {conn.idpMetadata?.provider ?? 'SAML Connection'}
                      </span>
                      <span className="text-[10px] text-sg-text3 ml-2 font-mono">
                        {conn.clientID.slice(0, 12)}...
                      </span>
                    </div>
                    <span className="text-xs text-sg-ship">Active</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-sg-text3 mb-3">No SAML connections configured.</p>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-sg-text2">
                IdP Metadata URL
              </label>
              <input
                type="url"
                value={metadataUrl}
                onChange={(e) => setMetadataUrl(e.target.value)}
                placeholder="https://idp.example.com/metadata.xml"
                className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
              />
              <button
                onClick={handleCreateConnection}
                disabled={samlSaving || !metadataUrl.trim()}
                className="px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                {samlSaving ? 'Saving...' : 'Add Connection'}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-sg-border text-xs text-sg-text3 space-y-1">
              <p><strong className="text-sg-text2">ACS URL:</strong> {process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.shipgate.dev'}/api/auth/saml/acs</p>
              <p><strong className="text-sg-text2">Entity ID:</strong> https://saml.shipgate.dev</p>
            </div>
          </div>

          {/* SSO enforcement */}
          <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
            <h2 className="text-sm font-semibold text-sg-text0 mb-4">SSO Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-sg-text0">Enable SSO</p>
                  <p className="text-xs text-sg-text3">Allow users to sign in via SAML SSO</p>
                </div>
                <button
                  onClick={handleToggleEnabled}
                  disabled={connections.length === 0}
                  className={`w-10 h-5 rounded-full relative transition-colors ${
                    orgSso?.ssoEnabled ? 'bg-sg-ship' : 'bg-sg-bg3'
                  } disabled:opacity-40`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    orgSso?.ssoEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-sg-text0">Enforce SSO</p>
                  <p className="text-xs text-sg-text3">Require all org members to use SSO (domain must be verified)</p>
                </div>
                <button
                  onClick={handleToggleEnforce}
                  disabled={!orgSso?.ssoEnabled || !orgSso?.domainVerified}
                  className={`w-10 h-5 rounded-full relative transition-colors ${
                    orgSso?.ssoEnforced ? 'bg-sg-ship' : 'bg-sg-bg3'
                  } disabled:opacity-40`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    orgSso?.ssoEnforced ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
