/**
 * Deploy Stage Generator
 * 
 * Generates deployment stage configuration.
 */

import type { PipelineConfig } from '../generator.js';

export interface DeployStageConfig {
  name: string;
  environment: string;
  branch: string;
  script: string;
  manual: boolean;
}

/**
 * Generate deploy stage configuration
 */
export function generateDeployStage(config: PipelineConfig): DeployStageConfig {
  const { deployEnvironment, deployBranch, deployScript } = config.options;

  return {
    name: 'deploy',
    environment: deployEnvironment,
    branch: deployBranch,
    script: deployScript,
    manual: false,
  };
}

/**
 * Generate GitHub Actions deploy job
 */
export function generateGitHubDeployJob(
  config: PipelineConfig,
  dependencies: string[]
): string {
  const stage = generateDeployStage(config);
  const { nodeVersion } = config.options;
  const needsList = dependencies.map((d) => `'${d}'`).join(', ');

  return `  ${stage.name}:
    needs: [${needsList}]
    if: github.ref == 'refs/heads/${stage.branch}'
    runs-on: ubuntu-latest
    environment: ${stage.environment}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Build
        run: npm run build
      - name: Deploy
        run: ${stage.script}
        env:
          DEPLOY_ENV: ${stage.environment}`;
}

/**
 * Generate GitLab CI deploy job
 */
export function generateGitLabDeployJob(
  config: PipelineConfig,
  dependencies: string[]
): string {
  const stage = generateDeployStage(config);
  const { nodeVersion } = config.options;
  const needsList = dependencies.map((d) => `    - ${d}`).join('\n');

  return `${stage.name}:
  stage: deploy
  image: node:${nodeVersion}
  needs:
${needsList}
  environment:
    name: ${stage.environment}
  rules:
    - if: $CI_COMMIT_BRANCH == "${stage.branch}"
  script:
    - npm ci
    - npm run build
    - ${stage.script}`;
}

/**
 * Generate CircleCI deploy job
 */
export function generateCircleCIDeployJob(config: PipelineConfig): string {
  const stage = generateDeployStage(config);
  const { nodeVersion } = config.options;

  return `  ${stage.name}:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: Build
          command: npm run build
      - run:
          name: Deploy to ${stage.environment}
          command: ${stage.script}`;
}

/**
 * Generate Jenkins deploy stage
 */
export function generateJenkinsDeployStage(config: PipelineConfig): string {
  const stage = generateDeployStage(config);

  return `        stage('Deploy') {
            when {
                branch '${stage.branch}'
            }
            environment {
                DEPLOY_ENV = '${stage.environment}'
            }
            steps {
                sh 'npm ci'
                sh 'npm run build'
                sh '${stage.script}'
            }
        }`;
}
