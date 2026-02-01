/**
 * Check Stage Generator
 * 
 * Generates lint and type-checking stage configuration.
 */

import type { PipelineConfig } from '../generator.js';

export interface CheckStageConfig {
  name: string;
  steps: CheckStep[];
}

export interface CheckStep {
  name: string;
  command: string;
}

/**
 * Generate check stage configuration
 */
export function generateCheckStage(config: PipelineConfig): CheckStageConfig {
  const { sourceDir } = config.options;

  const steps: CheckStep[] = [
    {
      name: 'ISL Check',
      command: `npx isl check ${sourceDir}/**/*.isl`,
    },
    {
      name: 'Generate Types',
      command: 'npx isl generate --types',
    },
    {
      name: 'TypeScript Check',
      command: 'npx tsc --noEmit',
    },
  ];

  // Add ESLint if we have many behaviors (larger codebase)
  if (config.domain.behaviorCount > 5) {
    steps.push({
      name: 'Lint',
      command: 'npm run lint',
    });
  }

  return {
    name: 'check',
    steps,
  };
}

/**
 * Generate GitHub Actions check job
 */
export function generateGitHubCheckJob(config: PipelineConfig): string {
  const stage = generateCheckStage(config);
  const { nodeVersion } = config.options;

  const steps = stage.steps
    .map((step) => `      - name: ${step.name}\n        run: ${step.command}`)
    .join('\n');

  return `  ${stage.name}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
${steps}`;
}

/**
 * Generate GitLab CI check job
 */
export function generateGitLabCheckJob(config: PipelineConfig): string {
  const stage = generateCheckStage(config);
  const { nodeVersion } = config.options;

  const scripts = stage.steps.map((step) => `    - ${step.command}`).join('\n');

  return `${stage.name}:
  stage: check
  image: node:${nodeVersion}
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
${scripts}`;
}

/**
 * Generate CircleCI check job
 */
export function generateCircleCICheckJob(config: PipelineConfig): string {
  const stage = generateCheckStage(config);
  const { nodeVersion } = config.options;

  const steps = stage.steps
    .map((step) => `          - run:\n              name: ${step.name}\n              command: ${step.command}`)
    .join('\n');

  return `  ${stage.name}:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package-lock.json" }}
${steps}`;
}

/**
 * Generate Jenkins check stage
 */
export function generateJenkinsCheckStage(config: PipelineConfig): string {
  const stage = generateCheckStage(config);

  const steps = stage.steps
    .map((step) => `                sh '${step.command}'`)
    .join('\n');

  return `        stage('Check') {
            steps {
                sh 'npm ci'
${steps}
            }
        }`;
}
