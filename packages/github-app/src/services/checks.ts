/**
 * Check Service
 * 
 * Manages GitHub Check Runs API integration.
 */

import type { App } from '@octokit/app';

export interface CheckService {
  createCheckRun(params: CreateCheckRunParams): Promise<void>;
  updateCheckRun(params: UpdateCheckRunParams): Promise<void>;
}

export interface CreateCheckRunParams {
  owner: string;
  repo: string;
  name: string;
  headSha: string;
  status: 'queued' | 'in_progress';
}

export interface UpdateCheckRunParams {
  owner: string;
  repo: string;
  checkRunId: number;
  status: 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  output?: {
    title: string;
    summary: string;
    text?: string;
    annotations?: CheckAnnotation[];
  };
}

export interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
  raw_details?: string;
}

/**
 * Create check service
 */
export function createCheckService(octokitApp: App): CheckService {
  return {
    async createCheckRun(params: CreateCheckRunParams): Promise<void> {
      const { owner, repo, name, headSha, status } = params;

      // Get installation token
      const installation = await octokitApp.getInstallationOctokit(
        await octokitApp.getInstallationId({ owner, repo })
      );

      await installation.rest.checks.create({
        owner,
        repo,
        name,
        head_sha: headSha,
        status,
      });
    },

    async updateCheckRun(params: UpdateCheckRunParams): Promise<void> {
      const { owner, repo, checkRunId, status, conclusion, output } = params;

      // Get installation token
      const installation = await octokitApp.getInstallationOctokit(
        await octokitApp.getInstallationId({ owner, repo })
      );

      await installation.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status,
        conclusion,
        output,
      });
    },
  };
}
