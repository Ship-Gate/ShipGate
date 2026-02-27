'use client';

import { useApi } from './use-api';
import { apiClient } from '@/lib/api-client';
import { useCallback } from 'react';

// ── GitHub ──────────────────────────────────────────────────────────────

export interface GitHubStatus {
  connected: boolean;
  connections: Array<{
    id: string;
    orgId: string;
    login: string;
    avatarUrl: string | null;
    scope: string;
    createdAt: string;
  }>;
}

export interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  url: string;
  description: string | null;
  language: string | null;
  updatedAt: string;
  defaultBranch: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  url: string;
  repo: string;
  author: string;
  authorAvatar: string;
  branch: string;
  baseBranch: string;
  labels: Array<{ name: string; color: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubCommit {
  sha: string;
  shortSha: string;
  url: string;
  message: string;
  author: string;
  authorAvatar: string | null;
  date: string;
  repo: string;
}

export function useGitHubStatus() {
  return useApi<GitHubStatus>('/api/v1/integrations/github/status');
}

export function useGitHubRepos() {
  return useApi<{ connected: boolean; repos: GitHubRepo[] }>(
    '/api/v1/integrations/github/repos'
  );
}

export function useGitHubPrs() {
  return useApi<{ connected: boolean; prs: GitHubPR[] }>(
    '/api/v1/integrations/github/prs'
  );
}

export function useGitHubCommits(limit = 15) {
  return useApi<{ connected: boolean; commits: GitHubCommit[] }>(
    `/api/v1/integrations/github/commits?limit=${limit}`
  );
}

export function useGitHubDisconnect() {
  return useCallback(async (connectionId: string) => {
    await apiClient.post('/api/integrations/github/disconnect', {
      connectionId,
    });
  }, []);
}

// ── Slack ────────────────────────────────────────────────────────────────

export interface SlackStatus {
  connected: boolean;
  connection: {
    id: string;
    teamName: string;
    createdAt: string;
  } | null;
  rules: SlackRule[];
}

export interface SlackRule {
  id: string;
  channelId: string;
  channelName: string;
  event: string;
  enabled: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export function useSlackStatus() {
  return useApi<SlackStatus>('/api/v1/integrations/slack/status');
}

export function useSlackChannels() {
  return useApi<{ channels: SlackChannel[] }>(
    '/api/v1/integrations/slack/channels'
  );
}

// ── Deployments ─────────────────────────────────────────────────────────

export interface DeploymentProviderInfo {
  id: string;
  provider: string;
  projectFilter: string | null;
  createdAt: string;
}

export interface DeploymentItem {
  id: string;
  provider: string;
  externalId: string;
  projectName: string;
  environment: string | null;
  status: string;
  url: string | null;
  commitSha: string | null;
  branch: string | null;
  creator: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export function useDeploymentProviders() {
  return useApi<{
    providers: DeploymentProviderInfo[];
  }>('/api/v1/integrations/deployments/status');
}

export function useDeployments(limit = 20) {
  return useApi<{
    deployments: DeploymentItem[];
  }>(`/api/v1/integrations/deployments/list?limit=${limit}`);
}
