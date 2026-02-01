/**
 * Verify Stage Generator
 * 
 * Generates ISL verification stage configuration with behavior matrix.
 */

import type { PipelineConfig } from '../generator.js';

export interface VerifyStageConfig {
  name: string;
  behaviors: string[];
  parallel: boolean;
  maxParallel: number;
}

/**
 * Generate verify stage configuration
 */
export function generateVerifyStage(config: PipelineConfig): VerifyStageConfig {
  const { behaviors } = config.domain;
  const { maxParallel } = config.options;

  return {
    name: 'verify',
    behaviors,
    parallel: behaviors.length > 1,
    maxParallel: Math.min(behaviors.length, maxParallel),
  };
}

/**
 * Generate GitHub Actions verify job with matrix strategy
 */
export function generateGitHubVerifyJob(config: PipelineConfig): string {
  const stage = generateVerifyStage(config);
  const { nodeVersion, sourceDir } = config.options;

  if (stage.behaviors.length === 0) {
    return `  ${stage.name}:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Verify All
        run: npx isl verify --all`;
  }

  const behaviorList = stage.behaviors.map((b) => `'${b}'`).join(', ');

  return `  ${stage.name}:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      max-parallel: ${stage.maxParallel}
      matrix:
        behavior: [${behaviorList}]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      - run: npm ci
      - name: Verify \${{ matrix.behavior }}
        uses: isl-lang/verify-action@v1
        with:
          behavior: \${{ matrix.behavior }}
          implementation: ${sourceDir}/\${{ matrix.behavior }}.ts`;
}

/**
 * Generate GitLab CI verify job with parallel matrix
 */
export function generateGitLabVerifyJob(config: PipelineConfig): string {
  const stage = generateVerifyStage(config);
  const { nodeVersion, sourceDir } = config.options;

  if (stage.behaviors.length === 0) {
    return `${stage.name}:
  stage: verify
  image: node:${nodeVersion}
  needs:
    - test
  script:
    - npm ci
    - npx isl verify --all`;
  }

  const behaviorList = stage.behaviors.map((b) => `    - ${b}`).join('\n');

  return `${stage.name}:
  stage: verify
  image: node:${nodeVersion}
  needs:
    - test
  parallel:
    matrix:
      - BEHAVIOR:
${behaviorList}
  script:
    - npm ci
    - npx isl verify --behavior=$BEHAVIOR --implementation=${sourceDir}/$BEHAVIOR.ts`;
}

/**
 * Generate CircleCI verify job
 */
export function generateCircleCIVerifyJob(config: PipelineConfig): string {
  const stage = generateVerifyStage(config);
  const { nodeVersion, sourceDir } = config.options;

  if (stage.behaviors.length === 0) {
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
          name: Verify All
          command: npx isl verify --all`;
  }

  // Generate individual jobs for each behavior
  const jobs = stage.behaviors.map((behavior) => `  verify-${behavior.toLowerCase()}:
    docker:
      - image: cimg/node:${nodeVersion}
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
      - run: npm ci
      - run:
          name: Verify ${behavior}
          command: npx isl verify --behavior=${behavior} --implementation=${sourceDir}/${behavior}.ts`);

  return jobs.join('\n\n');
}

/**
 * Generate Jenkins verify stage
 */
export function generateJenkinsVerifyStage(config: PipelineConfig): string {
  const stage = generateVerifyStage(config);
  const { sourceDir } = config.options;

  if (stage.behaviors.length === 0) {
    return `        stage('Verify') {
            steps {
                sh 'npm ci'
                sh 'npx isl verify --all'
            }
        }`;
  }

  const parallelStages = stage.behaviors
    .map((behavior) => `                    stage('${behavior}') {
                        steps {
                            sh 'npx isl verify --behavior=${behavior} --implementation=${sourceDir}/${behavior}.ts'
                        }
                    }`)
    .join('\n');

  return `        stage('Verify') {
            parallel {
${parallelStages}
            }
        }`;
}

/**
 * Get verify job names for CircleCI workflow
 */
export function getCircleCIVerifyJobNames(config: PipelineConfig): string[] {
  const stage = generateVerifyStage(config);
  
  if (stage.behaviors.length === 0) {
    return ['verify'];
  }
  
  return stage.behaviors.map((b) => `verify-${b.toLowerCase()}`);
}
