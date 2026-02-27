/**
 * GitLab CI Pipeline Generator
 * 
 * Generates GitLab CI configuration files.
 */

import type { PipelineConfig, GeneratedFile } from '../generator.js';
import { requiresSecurityScanning } from '../generator.js';
import { generateGitLabCheckJob } from '../stages/check.js';
import { generateGitLabTestJob } from '../stages/test.js';
import { generateGitLabVerifyJob } from '../stages/verify.js';
import { generateGitLabDeployJob } from '../stages/deploy.js';

/**
 * Generate GitLab CI configuration files
 */
export function generateGitLabCI(config: PipelineConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  files.push({
    path: '.gitlab-ci.yml',
    content: generateMainConfig(config),
  });

  return files;
}

/**
 * Generate the main GitLab CI configuration
 */
function generateMainConfig(config: PipelineConfig): string {
  const { domain, options } = config;
  const jobs: string[] = [];
  const stages = ['check', 'test', 'verify'];
  const deployDependencies: string[] = ['verify'];

  // Check job
  jobs.push(generateGitLabCheckJob(config));
  
  // Test job
  jobs.push(generateGitLabTestJob(config));
  
  // Verify job
  jobs.push(generateGitLabVerifyJob(config));

  // Chaos testing job
  if (domain.hasChaosScenarios || domain.hasTemporalRequirements) {
    stages.push('chaos');
    jobs.push(generateGitLabChaosJob(config));
    deployDependencies.push('chaos');
  }

  // Security scanning job
  if (requiresSecurityScanning(domain.complianceStandards)) {
    stages.push('security');
    jobs.push(generateGitLabSecurityJob(config, domain.complianceStandards));
    deployDependencies.push('security');
  }

  // Performance testing job
  if (domain.hasTemporalRequirements) {
    stages.push('performance');
    jobs.push(generateGitLabPerformanceJob(config));
    deployDependencies.push('performance');
  }

  // Deploy job
  if (options.includeDeploy) {
    stages.push('deploy');
    jobs.push(generateGitLabDeployJob(config, deployDependencies));
  }

  const stagesList = stages.map((s) => `  - ${s}`).join('\n');

  return `# ISL Pipeline - Generated from ${domain.name} domain
# Do not edit manually - regenerate with: npx isl generate --pipeline

variables:
  ISL_VERSION: '${options.version}'
  NODE_VERSION: '${options.nodeVersion}'

default:
  cache:
    paths:
      - node_modules/

stages:
${stagesList}

${jobs.join('\n\n')}
`;
}

/**
 * Generate chaos testing job for GitLab
 */
function generateGitLabChaosJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `chaos:
  stage: chaos
  image: node:${nodeVersion}
  needs:
    - verify
  script:
    - npm ci
    - npx isl verify --chaos --scenarios=all
  artifacts:
    reports:
      dotenv: chaos-report.env
    paths:
      - chaos-report.json
    when: always`;
}

/**
 * Generate security scanning job for GitLab
 */
function generateGitLabSecurityJob(config: PipelineConfig, standards: string[]): string {
  const { nodeVersion } = config.options;
  const standardFlags = standards.map((s) => `--${s.toLowerCase().replace('_', '-')}`).join(' ');

  return `security:
  stage: security
  image: node:${nodeVersion}
  needs:
    - check
  script:
    - npm ci
    - npx isl scan ${standardFlags}
    - npm audit --audit-level=high
  artifacts:
    reports:
      sast: gl-sast-report.json
    paths:
      - security-report.json
    when: always

include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml`;
}

/**
 * Generate performance testing job for GitLab
 */
function generateGitLabPerformanceJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `performance:
  stage: performance
  image: node:${nodeVersion}
  needs:
    - test
  script:
    - npm ci
    - npx isl verify --temporal --percentiles=p50,p95,p99
    - npx isl verify --temporal --regression --threshold=10
  artifacts:
    reports:
      performance: performance-report.json
    paths:
      - performance-report.json`;
}
