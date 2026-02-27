'use client';

import {
  useGitHubStatus,
  useSlackStatus,
  useDeploymentProviders,
} from '@/hooks/use-integrations';
import { Github, MessageSquare, Rocket } from 'lucide-react';
import Link from 'next/link';

interface IntegrationCardProps {
  icon: React.ReactNode;
  name: string;
  connected: boolean;
  detail?: string;
  href: string;
  loading?: boolean;
}

function IntegrationCard({
  icon,
  name,
  connected,
  detail,
  href,
  loading,
}: IntegrationCardProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-card bg-sg-bg1 border border-sg-border hover:border-sg-accent/30 transition-colors flex-1 min-w-[180px]"
    >
      <div className="relative">
        <div className="w-8 h-8 rounded-lg bg-sg-bg3 flex items-center justify-center text-sg-text2">
          {icon}
        </div>
        {!loading && (
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sg-bg1 ${
              connected ? 'bg-sg-ship' : 'bg-sg-text3'
            }`}
          />
        )}
      </div>
      <div>
        <div className="text-xs font-medium text-sg-text0">{name}</div>
        <div className="text-[10px] text-sg-text3">
          {loading
            ? 'Loading...'
            : connected
              ? detail ?? 'Connected'
              : 'Not connected'}
        </div>
      </div>
    </Link>
  );
}

export function IntegrationsStrip() {
  const { data: gh, isLoading: ghLoading } = useGitHubStatus();
  const { data: slack, isLoading: slackLoading } = useSlackStatus();
  const { data: deploys, isLoading: deploysLoading } =
    useDeploymentProviders();

  const ghConnected = gh?.connected ?? false;
  const slackConnected = slack?.connected ?? false;
  const deployProviders = deploys?.providers ?? [];

  return (
    <div className="flex flex-wrap gap-3">
      <IntegrationCard
        icon={<Github className="w-4 h-4" />}
        name="GitHub"
        connected={ghConnected}
        detail={gh?.connections?.[0]?.login}
        href="/dashboard/prs"
        loading={ghLoading}
      />
      <IntegrationCard
        icon={<MessageSquare className="w-4 h-4" />}
        name="Slack"
        connected={slackConnected}
        detail={slack?.connection?.teamName}
        href="/dashboard/team"
        loading={slackLoading}
      />
      <IntegrationCard
        icon={<Rocket className="w-4 h-4" />}
        name="Deployments"
        connected={deployProviders.length > 0}
        detail={
          deployProviders.length > 0
            ? deployProviders.map((p) => p.provider).join(', ')
            : undefined
        }
        href="/dashboard/deploys"
        loading={deploysLoading}
      />
    </div>
  );
}
