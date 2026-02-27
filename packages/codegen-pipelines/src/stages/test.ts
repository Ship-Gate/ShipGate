/**
 * Test Stage Generator
 * 
 * Generates unit and integration test stage configuration.
 */

import type { PipelineConfig } from '../generator.js';

export interface TestStageConfig {
  name: string;
  steps: TestStep[];
  coverageThreshold?: number;
}

export interface TestStep {
  name: string;
  command: string;
}

/**
 * Generate test stage configuration
 */
export function generateTestStage(config: PipelineConfig): TestStageConfig {
  const steps: TestStep[] = [
    {
      name: 'Generate Tests',
      command: 'npx isl generate --tests',
    },
    {
      name: 'Run Tests',
      command: 'npm test -- --coverage',
    },
  ];

  // Add performance tests if temporal requirements exist
  if (config.domain.hasTemporalRequirements) {
    steps.push({
      name: 'Performance Tests',
      command: 'npm run test:performance',
    });
  }

  return {
    name: 'test',
    steps,
    coverageThreshold: 80,
  };
}

/**
 * Generate GitHub Actions test job
 */
export function generateGitHubTestJob(config: PipelineConfig): string {
  const stage = generateTestStage(config);
  const { nodeVersion } = config.options;

  const steps = stage.steps
    .map((step) => `      - name: ${step.name}\n        run: ${step.command}`)
    .join('\n');

  return `  ${stage.name}:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
${steps}
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: true`;
}

/**
 * Generate GitLab CI test job
 */
export function generateGitLabTestJob(config: PipelineConfig): string {
  const stage = generateTestStage(config);
  const { nodeVersion } = config.options;

  const scripts = stage.steps.map((step) => `    - ${step.command}`).join('\n');

  return `${stage.name}:
  stage: test
  image: node:${nodeVersion}
  needs:
    - check
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
${scripts}
  coverage: '/All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml`;
}

/**
 * Generate CircleCI test job
 */
export function generateCircleCITestJob(config: PipelineConfig): string {
  const stage = generateTestStage(config);
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
${steps}
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage`;
}

/**
 * Generate Jenkins test stage
 */
export function generateJenkinsTestStage(config: PipelineConfig): string {
  const stage = generateTestStage(config);

  const steps = stage.steps
    .map((step) => `                sh '${step.command}'`)
    .join('\n');

  return `        stage('Test') {
            steps {
                sh 'npm ci'
${steps}
            }
            post {
                always {
                    junit 'test-results/**/*.xml'
                    publishHTML([
                        reportDir: 'coverage/lcov-report',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }`;
}
