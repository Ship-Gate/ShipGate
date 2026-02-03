/**
 * Webhook Handler
 */

import express from 'express';
import type { App } from '@octokit/app';
import type { WebhookEvent } from '@octokit/webhooks-types';
import type { PolicyService } from './services/policy.js';
import type { CheckService } from './services/checks.js';
import type { SarifService } from './services/sarif.js';

export interface WebhookHandlerConfig {
  octokitApp: App;
  policyService: PolicyService;
  checkService: CheckService;
  sarifService: SarifService;
}

/**
 * Create webhook handler
 */
export function createWebhookHandler(config: WebhookHandlerConfig) {
  const { octokitApp, policyService, checkService, sarifService } = config;

  return async (req: express.Request, res: express.Response) => {
    try {
      // Verify webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      const id = req.headers['x-github-delivery'] as string;
      
      await octokitApp.webhooks.verify(req.body, signature);

      const event = req.headers['x-github-event'] as string;
      const payload = JSON.parse(req.body.toString()) as WebhookEvent;

      // Handle events
      switch (event) {
        case 'pull_request':
          await handlePullRequest(payload as any, { policyService, checkService, sarifService });
          break;
        case 'check_suite':
          await handleCheckSuite(payload as any, { policyService, checkService });
          break;
        case 'installation':
          await handleInstallation(payload as any, { policyService });
          break;
        default:
          console.log(`Unhandled event: ${event}`);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}

/**
 * Handle pull request events
 */
async function handlePullRequest(
  payload: WebhookEvent<'pull_request'>,
  services: { policyService: PolicyService; checkService: CheckService; sarifService: SarifService }
) {
  const { action, pull_request, repository } = payload;
  
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    return;
  }

  const org = repository.owner.login;
  const repo = repository.name;
  const prNumber = pull_request.number;
  const sha = pull_request.head.sha;

  // Get org's policy bundle
  const bundle = await services.policyService.getOrgBundle(org);

  // Create check runs for each required policy
  for (const policyId of bundle.policies.required.map(p => p.id)) {
    await services.checkService.createCheckRun({
      owner: org,
      repo,
      name: `isl-${policyId}-check`,
      headSha: sha,
      status: 'in_progress',
    });
  }

  // Run policy checks (async)
  // TODO: Queue for async processing
  await runPolicyChecks({
    org,
    repo,
    prNumber,
    sha,
    bundle,
    services,
  });
}

/**
 * Handle check suite events
 */
async function handleCheckSuite(
  payload: WebhookEvent<'check_suite'>,
  services: { policyService: PolicyService; checkService: CheckService }
) {
  const { action, check_suite, repository } = payload;
  
  if (action !== 'requested' && action !== 'rerequested') {
    return;
  }

  const org = repository.owner.login;
  const bundle = await services.policyService.getOrgBundle(org);

  // Create check runs
  for (const policyId of bundle.policies.required.map(p => p.id)) {
    await services.checkService.createCheckRun({
      owner: org,
      repo: repository.name,
      name: `isl-${policyId}-check`,
      headSha: check_suite.head_sha,
      status: 'queued',
    });
  }
}

/**
 * Handle installation events
 */
async function handleInstallation(
  payload: WebhookEvent<'installation'>,
  services: { policyService: PolicyService }
) {
  const { action, installation } = payload;
  
  if (action === 'created') {
    // Set default policy bundle for new installations
    // TODO: Implement default bundle assignment
    console.log(`New installation: ${installation.id}`);
  }
}

/**
 * Run policy checks
 */
async function runPolicyChecks(params: {
  org: string;
  repo: string;
  prNumber: number;
  sha: string;
  bundle: any;
  services: { policyService: PolicyService; checkService: CheckService; sarifService: SarifService };
}) {
  const { org, repo, prNumber, sha, bundle, services } = params;

  // TODO: Implement actual policy checking
  // 1. Fetch repository code
  // 2. Load policy packs
  // 3. Run checks
  // 4. Update check runs
  // 5. Post annotations
  // 6. Upload SARIF

  console.log(`Running policy checks for ${org}/${repo}#${prNumber}`);
}
