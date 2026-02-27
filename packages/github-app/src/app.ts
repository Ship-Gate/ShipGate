/**
 * GitHub App Implementation
 */

import express from 'express';
import { App } from '@octokit/app';
import { createWebhookHandler } from './webhooks.js';
import { createPolicyService } from './services/policy.js';
import { createCheckService } from './services/checks.js';
import { createSarifService } from './services/sarif.js';

export interface AppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  port?: number;
}

export interface AppInstance {
  router: express.Router;
  octokitApp: App;
  start: () => Promise<void>;
}

/**
 * Create GitHub App instance
 */
export function createApp(config: AppConfig): AppInstance {
  const router = express.Router();
  
  // Create Octokit App
  const octokitApp = new App({
    appId: config.appId,
    privateKey: config.privateKey,
    webhookSecret: config.webhookSecret,
  });

  // Initialize services
  const policyService = createPolicyService();
  const checkService = createCheckService(octokitApp);
  const sarifService = createSarifService();

  // Create webhook handler
  const webhookHandler = createWebhookHandler({
    octokitApp,
    policyService,
    checkService,
    sarifService,
  });

  // Mount webhook endpoint
  router.post('/webhooks/github', express.raw({ type: 'application/json' }), webhookHandler);

  // API routes
  router.get('/orgs/:org/bundle', async (req, res) => {
    try {
      const bundle = await policyService.getOrgBundle(req.params.org);
      res.json(bundle);
    } catch (error) {
      res.status(404).json({ error: 'Bundle not found' });
    }
  });

  router.put('/orgs/:org/bundle', async (req, res) => {
    try {
      // TODO: Add authentication/authorization
      const bundle = await policyService.pinBundle(req.params.org, req.body);
      res.json(bundle);
    } catch (error) {
      res.status(400).json({ error: 'Failed to pin bundle' });
    }
  });

  return {
    router,
    octokitApp,
    start: async () => {
      // Start any background services
      console.log('GitHub App started');
    },
  };
}
