/**
 * GitHub Actions Pipeline Generator
 * 
 * Generates GitHub Actions workflow YAML files.
 */

import type { PipelineConfig, GeneratedFile } from '../generator.js';
import { requiresSecurityScanning } from '../generator.js';
import { generateGitHubCheckJob } from '../stages/check.js';
import { generateGitHubTestJob } from '../stages/test.js';
import { generateGitHubVerifyJob } from '../stages/verify.js';
import { generateGitHubDeployJob } from '../stages/deploy.js';

/**
 * Generate GitHub Actions workflow files
 */
export function generateGitHubActions(config: PipelineConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Main CI workflow
  files.push({
    path: '.github/workflows/isl-pipeline.yml',
    content: generateMainWorkflow(config),
  });

  return files;
}

/**
 * Generate the main CI/CD workflow
 */
function generateMainWorkflow(config: PipelineConfig): string {
  const { domain, options } = config;
  const jobs: string[] = [];
  const deployDependencies: string[] = [];

  // Check job
  jobs.push(generateGitHubCheckJob(config));
  
  // Test job
  jobs.push(generateGitHubTestJob(config));
  
  // Verify job (with behavior matrix)
  jobs.push(generateGitHubVerifyJob(config));
  deployDependencies.push('verify');

  // Chaos testing job (if chaos scenarios exist or has resilience requirements)
  if (domain.hasChaosScenarios || domain.hasTemporalRequirements) {
    jobs.push(generateChaosJob(config));
    deployDependencies.push('chaos');
  }

  // Security scanning job (if compliance requires it)
  if (requiresSecurityScanning(domain.complianceStandards)) {
    jobs.push(generateSecurityJob(config, domain.complianceStandards));
    deployDependencies.push('security');
  }

  // Performance testing job (if temporal requirements exist)
  if (domain.hasTemporalRequirements) {
    jobs.push(generatePerformanceJob(config));
    deployDependencies.push('performance');
  }

  // Deploy job (if enabled)
  if (options.includeDeploy) {
    jobs.push(generateGitHubDeployJob(config, deployDependencies));
  }

  return `# ISL Pipeline - Generated from ${domain.name} domain
# Do not edit manually - regenerate with: npx isl generate --pipeline

name: ISL Pipeline

on:
  push:
    branches: [${options.deployBranch}]
  pull_request:

env:
  ISL_VERSION: '${options.version}'
  NODE_VERSION: '${options.nodeVersion}'

jobs:
${jobs.join('\n\n')}
`;
}

/**
 * Generate chaos testing job
 */
function generateChaosJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `  chaos:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Chaos Testing
        run: npx isl verify --chaos --scenarios=all
      - name: Upload Chaos Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: chaos-report
          path: chaos-report.json`;
}

/**
 * Generate security scanning job
 */
function generateSecurityJob(config: PipelineConfig, standards: string[]): string {
  const { nodeVersion } = config.options;
  const standardFlags = standards.map((s) => `--${s.toLowerCase().replace('_', '-')}`).join(' ');

  return `  security:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Security Scan
        run: npx isl scan ${standardFlags}
      - name: SAST Scan
        uses: github/codeql-action/analyze@v3
        with:
          languages: typescript
      - name: Dependency Audit
        run: npm audit --audit-level=high
      - name: Upload Security Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-report
          path: security-report.json`;
}

/**
 * Generate performance testing job
 */
function generatePerformanceJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `  performance:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Performance Tests
        run: npx isl verify --temporal --percentiles=p50,p95,p99
      - name: Upload Performance Report
        uses: actions/upload-artifact@v4
        with:
          name: performance-report
          path: performance-report.json
      - name: Performance Regression Check
        run: npx isl verify --temporal --regression --threshold=10`;
}
