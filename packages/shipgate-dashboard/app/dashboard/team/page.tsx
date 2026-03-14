'use client';

import { useState } from 'react';
import { useProfile } from '@/hooks/use-data';
import { useApi } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { SlackConnector } from '@/components/dashboard/slack-connector';
import { SlackNotificationConfig } from '@/components/dashboard/slack-notification-config';

interface OrgMember {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  role: string;
  joinedAt: string;
}

function roleColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'text-sg-accent bg-sg-accent-bg border-sg-accent/20';
    case 'member':
      return 'text-sg-ship bg-sg-ship-bg border-sg-ship/20';
    case 'viewer':
      return 'text-sg-text2 bg-sg-bg2 border-sg-border';
    default:
      return 'text-sg-text2 bg-sg-bg2 border-sg-border';
  }
}

export default function TeamPage() {
  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const activeOrgId = selectedOrgId ?? profile?.orgs?.[0]?.id ?? null;
  const activeOrg = profile?.orgs?.find((o) => o.id === activeOrgId);
  const isAdmin = activeOrg?.role === 'admin';

  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useApi<OrgMember[]>(activeOrgId ? `/api/v1/orgs/${activeOrgId}/members` : null);

  const isLoading = profileLoading || membersLoading;
  const error = profileError || membersError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Team</h1>
          <p className="text-sg-text2 text-sm">Manage workspace members and roles</p>
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Team</h1>
          <p className="text-sg-text2 text-sm">Manage workspace members and roles</p>
        </div>
        <ErrorState message={error} onRetry={() => { refetchProfile(); refetchMembers(); }} />
      </div>
    );
  }

  if (!profile || !activeOrgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Team</h1>
          <p className="text-sg-text2 text-sm">Manage workspace members and roles</p>
        </div>
        <EmptyState title="No workspace" description="Create a workspace to manage team members." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Team</h1>
          <p className="text-sg-text2 text-sm">Manage workspace members and roles</p>
        </div>
        {profile.orgs.length > 1 && (
          <select
            value={activeOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="text-sm bg-sg-bg2 border border-sg-border rounded-lg px-3 py-1.5 text-sg-text0 focus:outline-none focus:ring-1 focus:ring-sg-accent"
          >
            {profile.orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Org info */}
      <div className="rounded-xl border border-sg-border bg-sg-bg1 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-sg-text0">{activeOrg?.name}</p>
          <p className="text-xs text-sg-text3">
            {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''} · Your role:{' '}
            <span className="capitalize">{activeOrg?.role}</span>
          </p>
        </div>
      </div>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <InviteForm orgId={activeOrgId} onInvited={refetchMembers} />
      )}

      {/* Members table */}
      <div>
        <h2 className="text-lg font-semibold text-sg-text0 mb-4">Members</h2>
        {!members?.length ? (
          <EmptyState title="No members" description="Invite team members to collaborate." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Member
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Email
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Role
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Provider
                  </th>
                  {isAdmin && (
                    <th className="text-right p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.membershipId}
                    member={m}
                    orgId={activeOrgId}
                    isAdmin={isAdmin}
                    isCurrentUser={m.userId === profile.id}
                    onUpdated={refetchMembers}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slack integration */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-sg-text0">Slack Notifications</h2>
          <p className="text-xs text-sg-text3 mt-1">
            Connect Slack to receive real-time alerts for your workspace.
          </p>
        </div>
        <SlackConnector />
        <SlackNotificationConfig />
      </div>
    </div>
  );
}

function InviteForm({ orgId, onInvited }: { orgId: string; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.post(`/api/v1/orgs/${orgId}/members`, { email: email.trim(), role });
      setSuccess(`${email.trim()} added as ${role}`);
      setEmail('');
      onInvited();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-sg-border bg-sg-bg1 p-4">
      <h3 className="text-sm font-semibold text-sg-text0 mb-3">Add team member</h3>
      <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-sg-text2 block mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full bg-sg-bg2 border border-sg-border rounded-lg px-3 py-2 text-sm text-sg-text0 placeholder:text-sg-text3 focus:outline-none focus:ring-1 focus:ring-sg-accent"
            required
          />
        </div>
        <div>
          <label className="text-xs text-sg-text2 block mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-sg-bg2 border border-sg-border rounded-lg px-3 py-2 text-sm text-sg-text0 focus:outline-none focus:ring-1 focus:ring-sg-accent"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="px-4 py-2 rounded-lg bg-sg-accent text-white text-sm font-medium hover:bg-sg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Adding...' : 'Add member'}
        </button>
      </form>
      {error && <p className="text-xs text-sg-noship mt-2">{error}</p>}
      {success && <p className="text-xs text-sg-ship mt-2">{success}</p>}
    </div>
  );
}

function MemberRow({
  member,
  orgId,
  isAdmin,
  isCurrentUser,
  onUpdated,
}: {
  member: OrgMember;
  orgId: string;
  isAdmin: boolean;
  isCurrentUser: boolean;
  onUpdated: () => void;
}) {
  const [changingRole, setChangingRole] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRoleChange(newRole: string) {
    setChangingRole(true);
    try {
      await apiClient.post(`/api/v1/orgs/${orgId}/members/${member.membershipId}`, {
        role: newRole,
        _method: 'PATCH',
      });
      onUpdated();
    } catch {
      // role change failed silently; user can retry
    } finally {
      setChangingRole(false);
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${member.name ?? member.email} from this workspace?`)) return;
    setRemoving(true);
    try {
      await apiClient.delete(`/api/v1/orgs/${orgId}/members/${member.membershipId}`);
      onUpdated();
    } catch {
      // removal failed silently; user can retry
    } finally {
      setRemoving(false);
    }
  }

  return (
    <tr className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50">
      <td className="p-4">
        <div className="flex items-center gap-3">
          {member.avatar ? (
            <img src={member.avatar} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-sg-bg3 flex items-center justify-center text-sg-text2 text-xs font-medium">
              {(member.name ?? member.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-sg-text0">
              {member.name ?? member.email.split('@')[0]}
              {isCurrentUser && (
                <span className="text-xs text-sg-text3 ml-1.5">(you)</span>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="p-4 text-sm text-sg-text2">{member.email}</td>
      <td className="p-4">
        {isAdmin && !isCurrentUser ? (
          <select
            value={member.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={changingRole}
            className={`text-xs font-medium capitalize px-2 py-1 rounded-badge border bg-sg-bg2 border-sg-border text-sg-text0 focus:outline-none focus:ring-1 focus:ring-sg-accent ${changingRole ? 'opacity-50' : ''}`}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
        ) : (
          <span className={`text-xs font-medium capitalize px-2 py-1 rounded-badge border ${roleColor(member.role)}`}>
            {member.role}
          </span>
        )}
      </td>
      <td className="p-4 text-sm text-sg-text3 capitalize">{member.provider}</td>
      {isAdmin && (
        <td className="p-4 text-right">
          {!isCurrentUser && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-sg-noship hover:text-sg-noship/80 transition-colors disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Remove'}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
