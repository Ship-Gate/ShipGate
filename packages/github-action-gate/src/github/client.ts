/**
 * GitHub API client wrapper
 */

import { info, error, warning } from '@actions/core';
import { GitHubContext } from '../types.js';
import { GitHubComment, GitHubCheckRun, GitHubCheckAnnotation } from './types.js';

export class GitHubClient {
  constructor(
    private token: string,
    private context: GitHubContext
  ) {}

  /**
   * Create or update a PR comment
   */
  async upsertComment(
    body: string,
    marker: string = 'ISL Gate'
  ): Promise<void> {
    if (!this.context.pullRequest) {
      warning('Not in a pull request context. Cannot post comment.');
      return;
    }

    try {
      // List existing comments
      const commentsUrl = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/issues/${this.context.pullRequest.number}/comments`;
      
      const listResponse = await fetch(commentsUrl, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'isl-gate-action'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list comments: ${listResponse.statusText}`);
      }

      const comments: GitHubComment[] = await listResponse.json();
      
      // Find existing comment with marker
      const existingComment = comments.find(c => 
        c.user.type === 'Bot' && c.body.includes(marker)
      );

      if (existingComment) {
        // Update existing comment
        const updateUrl = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/issues/comments/${existingComment.id}`;
        
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'isl-gate-action'
          },
          body: JSON.stringify({ body })
        });

        if (!updateResponse.ok) {
          throw new Error(`Failed to update comment: ${updateResponse.statusText}`);
        }

        info(`Updated comment #${existingComment.id}`);
      } else {
        // Create new comment
        const createResponse = await fetch(commentsUrl, {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'isl-gate-action'
          },
          body: JSON.stringify({ body })
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create comment: ${createResponse.statusText}`);
        }

        const newComment: GitHubComment = await createResponse.json();
        info(`Created comment #${newComment.id}`);
      }
    } catch (err) {
      error(`Failed to upsert comment: ${err}`);
      throw err;
    }
  }

  /**
   * Create or update a check run
   */
  async createOrUpdateCheckRun(
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required',
    output?: {
      title: string;
      summary: string;
      text?: string;
      annotations?: GitHubCheckAnnotation[];
    }
  ): Promise<GitHubCheckRun> {
    const sha = this.context.pullRequest?.headSha || this.context.sha;

    try {
      // First try to find existing check run
      const listUrl = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/commits/${sha}/check-runs`;
      
      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'isl-gate-action'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list check runs: ${listResponse.statusText}`);
      }

      const listResult = await listResponse.json();
      const existingCheck = listResult.check_runs?.find((c: GitHubCheckRun) => 
        c.name === name && c.app?.slug === 'github-actions'
      );

      const checkData = {
        name,
        head_sha: sha,
        status,
        conclusion,
        output
      };

      let response: Response;
      let checkRun: GitHubCheckRun;

      if (existingCheck) {
        // Update existing check run
        const updateUrl = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/check-runs/${existingCheck.id}`;
        
        response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'isl-gate-action'
          },
          body: JSON.stringify(checkData)
        });

        checkRun = await response.json();
        info(`Updated check run #${existingCheck.id}`);
      } else {
        // Create new check run
        const createUrl = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/check-runs`;
        
        response = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'isl-gate-action'
          },
          body: JSON.stringify(checkData)
        });

        checkRun = await response.json();
        info(`Created check run #${checkRun.id}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to create/update check run: ${response.statusText}`);
      }

      return checkRun;
    } catch (err) {
      error(`Failed to create/update check run: ${err}`);
      throw err;
    }
  }

  /**
   * Get the pull request details
   */
  async getPullRequest(): Promise<any> {
    if (!this.context.pullRequest) {
      return null;
    }

    const url = `${this.context.apiUrl}/repos/${this.context.repository.owner}/${this.context.repository.repo}/pulls/${this.context.pullRequest.number}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'isl-gate-action'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get PR details: ${response.statusText}`);
    }

    return await response.json();
  }
}
