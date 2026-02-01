/**
 * CircleCI Pipeline Generator
 * 
 * Generates CircleCI configuration files.
 */

import type { PipelineConfig, GeneratedFile } from '../generator.js';
import { requiresSecurityScanning } from '../generator.js';
import { generateCircleCICheckJob } from '../stages/check.js';
import { generateCircleCITestJob } from '../stages/test.js';
import { generateCircleCIVerifyJob, getCircleCIVerifyJobNames } from '../stages/verify.js';
import { generateCircleCIDeployJob } from '../stages/deploy.js';

/**
 * Generate CircleCI configuration files
 */
export function generateCircleCI(config: PipelineConfig): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  files.push({
    path: '.circleci/config.yml',
    content: generateMainConfig(config),
  });

  return files;
}

/**
 * Generate the main CircleCI configuration
 */
function generateMainConfig(config: PipelineConfig): string {
  const { domain, options } = config;
  const jobs: string[] = [];
  const workflowJobs: string[] = [];

  // Check job
  jobs.push(generateCircleCICheckJob(config));
  workflowJobs.push('      - check');
  
  // Test job
  jobs.push(generateCircleCITestJob(config));
  workflowJobs.push('      - test:\n          requires:\n            - check');
  
  // Verify jobs
  const verifyJobs = generateCircleCIVerifyJob(config);
  jobs.push(verifyJobs);
  
  const verifyJobNames = getCircleCIVerifyJobNames(config);
  for (const jobName of verifyJobNames) {
    workflowJobs.push(`      - ${jobName}:\n          requires:\n            - test`);
  }

  // Chaos testing job
  if (domain.hasChaosScenarios || domain.hasTemporalRequirements) {
    jobs.push(generateCircleCIChaosJob(config));
    const verifyDeps = verifyJobNames.map((j) => `            - ${j}`).join('\n');
    workflowJobs.push(`      - chaos:\n          requires:\n${verifyDeps}`);
  }

  // Security scanning job
  if (requiresSecurityScanning(domain.complianceStandards)) {
    jobs.push(generateCircleCISecurityJob(config, domain.complianceStandards));
    workflowJobs.push('      - security:\n          requires:\n            - check');
  }

  // Performance testing job
  if (domain.hasTemporalRequirements) {
    jobs.push(generateCircleCIPerformanceJob(config));
    workflowJobs.push('      - performance:\n          requires:\n            - test');
  }

  // Deploy job
  if (options.includeDeploy) {
    jobs.push(generateCircleCIDeployJob(config));
    
    // Collect all jobs that deploy depends on
    const deployRequires = [...verifyJobNames];
    if (domain.hasChaosScenarios || domain.hasTemporalRequirements) {
      deployRequires.push('chaos');
    }
    if (requiresSecurityScanning(domain.complianceStandards)) {
      deployRequires.push('security');
    }
    if (domain.hasTemporalRequirements) {
      deployRequires.push('performance');
    }
    
    const deployDeps = deployRequires.map((j) => `            - ${j}`).join('\n');
    workflowJobs.push(`      - deploy:\n          requires:\n${deployDeps}\n          filters:\n            branches:\n              only: ${options.deployBranch}`);
  }

  return `# ISL Pipeline - Generated from ${domain.name} domain
# Do not edit manually - regenerate with: npx isl generate --pipeline

version: 2.1

orbs:
  node: circleci/node@5.2

jobs:
${jobs.join('\n\n')}

workflows:
  isl-pipeline:
    jobs:
${workflowJobs.join('\n')}
`;
}

/**
 * Generate chaos testing job for CircleCI
 */
function generateCircleCIChaosJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `  chaos:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: Chaos Testing
          command: npx isl verify --chaos --scenarios=all
      - store_artifacts:
          path: chaos-report.json`;
}

/**
 * Generate security scanning job for CircleCI
 */
function generateCircleCISecurityJob(config: PipelineConfig, standards: string[]): string {
  const { nodeVersion } = config.options;
  const standardFlags = standards.map((s) => `--${s.toLowerCase().replace('_', '-')}`).join(' ');

  return `  security:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: ISL Security Scan
          command: npx isl scan ${standardFlags}
      - run:
          name: Dependency Audit
          command: npm audit --audit-level=high
      - store_artifacts:
          path: security-report.json`;
}

/**
 * Generate performance testing job for CircleCI
 */
function generateCircleCIPerformanceJob(config: PipelineConfig): string {
  const { nodeVersion } = config.options;

  return `  performance:
    docker:
      - image: cimg/node:${nodeVersion}
    resource_class: medium+
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: Performance Tests
          command: npx isl verify --temporal --percentiles=p50,p95,p99
      - run:
          name: Regression Check
          command: npx isl verify --temporal --regression --threshold=10
      - store_artifacts:
          path: performance-report.json`;
}
