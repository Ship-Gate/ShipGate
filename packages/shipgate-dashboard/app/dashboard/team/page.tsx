'use client';

import { useProfile } from '@/hooks/use-data';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { SlackConnector } from '@/components/dashboard/slack-connector';
import { SlackNotificationConfig } from '@/components/dashboard/slack-notification-config';
import Image from 'next/image';

export default function TeamPage() {
  const { data: profile, isLoading, error, refetch } = useProfile();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Team</h1>
          <p className="text-sm text-sg-text3 mt-1">
            Workspace members and organization
          </p>
        </div>
        <div className="space-y-4">
          <Card className="bg-sg-bg1 border border-sg-border">
            <CardHeader>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Team</h1>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">Team</h1>
          <p className="text-sm text-sg-text3 mt-1">
            Workspace members and organization
          </p>
        </div>
        <EmptyState
          title="Invite team members"
          description="Share your workspace to collaborate."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-sg-text0">Team</h1>
        <p className="text-sm text-sg-text3 mt-1">
          Workspace members and organization
        </p>
      </div>

      <Card className="bg-sg-bg1 border border-sg-border">
        <CardHeader>
          <CardTitle className="text-base text-sg-text0">
            Current user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt=""
                width={40}
                height={40}
                className="rounded-full border border-sg-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-sg-bg3 flex items-center justify-center text-sg-text2 text-sm font-medium">
                {(profile.name ?? profile.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-sg-text0">
                {profile.name ?? profile.email}
              </p>
              <p className="text-xs text-sg-text3">{profile.email}</p>
              <p className="text-xs text-sg-text3 mt-0.5">
                via {profile.provider}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {profile.orgs.length > 0 ? (
        <Card className="bg-sg-bg1 border border-sg-border">
          <CardHeader>
            <CardTitle className="text-base text-sg-text0">
              Organization membership
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {profile.orgs.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-sg-bg2 border border-sg-border"
                >
                  <span className="text-sm font-medium text-sg-text0">
                    {org.name}
                  </span>
                  <span className="text-xs text-sg-text3 capitalize">
                    {org.role}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Invite team members"
          description="Share your workspace to collaborate."
        />
      )}

      {/* Slack integration */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-sg-text0">
            Slack Notifications
          </h2>
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
