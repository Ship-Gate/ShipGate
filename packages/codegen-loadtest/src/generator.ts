// ============================================================================
// Load Test Generator - Main Logic
// ============================================================================

import type { Domain, BehaviorSLA } from './ast-types';
import { extractBehaviorSLA } from './thresholds';
import { generateK6Script } from './frameworks/k6';
import { generateArtilleryConfig, generateArtilleryHelpers } from './frameworks/artillery';
import {
  generateGatlingSimulation,
  generateGatlingBuildSbt,
  generateGatlingPluginsSbt,
} from './frameworks/gatling';
import type { ScenarioType } from './scenarios';
import type { Framework } from './frameworks';

export interface GeneratorOptions {
  /** Load testing framework */
  framework: Framework;
  /** Test scenarios to generate */
  scenarios?: ScenarioType[];
  /** Base URL for the API */
  baseUrl?: string;
  /** Output directory */
  outputDir?: string;
}

export interface GeneratedFile {
  /** File path */
  path: string;
  /** File contents */
  content: string;
}

const DEFAULT_OPTIONS: Required<Omit<GeneratorOptions, 'framework'>> = {
  scenarios: ['smoke', 'load', 'stress', 'spike'],
  baseUrl: 'http://localhost:3000',
  outputDir: './loadtest',
};

/**
 * Generate load tests from ISL Domain
 */
export function generateLoadTests(domain: Domain, options: GeneratorOptions): GeneratedFile[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Extract SLA information from behaviors
  const behaviorSLAs = domain.behaviors.map(extractBehaviorSLA);
  
  // Generate based on framework
  switch (opts.framework) {
    case 'k6':
      return generateK6Files(behaviorSLAs, opts);
    case 'artillery':
      return generateArtilleryFiles(behaviorSLAs, opts);
    case 'gatling':
      return generateGatlingFiles(behaviorSLAs, opts);
    default:
      throw new Error(`Unknown framework: ${opts.framework}`);
  }
}

/**
 * Generate k6 files
 */
function generateK6Files(
  behaviors: BehaviorSLA[],
  options: Required<Omit<GeneratorOptions, 'framework'>>
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  
  // Main test script
  const script = generateK6Script(behaviors, {
    baseUrl: options.baseUrl,
    scenarios: options.scenarios,
  });
  
  files.push({
    path: `${options.outputDir}/test.js`,
    content: script,
  });
  
  // Package.json for running k6
  files.push({
    path: `${options.outputDir}/package.json`,
    content: generateK6Package(),
  });
  
  // README
  files.push({
    path: `${options.outputDir}/README.md`,
    content: generateK6Readme(behaviors),
  });
  
  return files;
}

/**
 * Generate Artillery files
 */
function generateArtilleryFiles(
  behaviors: BehaviorSLA[],
  options: Required<Omit<GeneratorOptions, 'framework'>>
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  
  // Main config
  const config = generateArtilleryConfig(behaviors, {
    baseUrl: options.baseUrl,
    scenarios: options.scenarios,
  });
  
  files.push({
    path: `${options.outputDir}/loadtest.yml`,
    content: config,
  });
  
  // Helpers
  files.push({
    path: `${options.outputDir}/helpers.js`,
    content: generateArtilleryHelpers(),
  });
  
  // Package.json
  files.push({
    path: `${options.outputDir}/package.json`,
    content: generateArtilleryPackage(),
  });
  
  // README
  files.push({
    path: `${options.outputDir}/README.md`,
    content: generateArtilleryReadme(behaviors),
  });
  
  return files;
}

/**
 * Generate Gatling files
 */
function generateGatlingFiles(
  behaviors: BehaviorSLA[],
  options: Required<Omit<GeneratorOptions, 'framework'>>
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const packageName = 'loadtest';
  
  // Main simulation
  const simulation = generateGatlingSimulation(behaviors, {
    baseUrl: options.baseUrl,
    scenarios: options.scenarios,
    packageName,
    simulationName: 'LoadTestSimulation',
  });
  
  files.push({
    path: `${options.outputDir}/src/test/scala/${packageName}/LoadTestSimulation.scala`,
    content: simulation,
  });
  
  // Build files
  files.push({
    path: `${options.outputDir}/build.sbt`,
    content: generateGatlingBuildSbt({ baseUrl: options.baseUrl, scenarios: options.scenarios, packageName }),
  });
  
  files.push({
    path: `${options.outputDir}/project/plugins.sbt`,
    content: generateGatlingPluginsSbt(),
  });
  
  // README
  files.push({
    path: `${options.outputDir}/README.md`,
    content: generateGatlingReadme(behaviors),
  });
  
  return files;
}

/**
 * Generate k6 package.json
 */
function generateK6Package(): string {
  return JSON.stringify({
    name: 'loadtest-k6',
    version: '1.0.0',
    description: 'k6 load tests generated from ISL',
    scripts: {
      'test:smoke': 'k6 run --env SCENARIO=smoke test.js',
      'test:load': 'k6 run --env SCENARIO=load test.js',
      'test:stress': 'k6 run --env SCENARIO=stress test.js',
      'test:spike': 'k6 run --env SCENARIO=spike test.js',
      'test:soak': 'k6 run --env SCENARIO=soak test.js',
      'test:all': 'k6 run test.js',
    },
    devDependencies: {},
  }, null, 2);
}

/**
 * Generate Artillery package.json
 */
function generateArtilleryPackage(): string {
  return JSON.stringify({
    name: 'loadtest-artillery',
    version: '1.0.0',
    description: 'Artillery load tests generated from ISL',
    scripts: {
      test: 'artillery run loadtest.yml',
      'test:report': 'artillery run --output report.json loadtest.yml && artillery report report.json',
    },
    devDependencies: {
      artillery: '^2.0.0',
      'artillery-plugin-expect': '^2.0.0',
    },
  }, null, 2);
}

/**
 * Generate k6 README
 */
function generateK6Readme(behaviors: BehaviorSLA[]): string {
  const behaviorList = behaviors.map(b => `- ${b.name}`).join('\n');
  const thresholdList = behaviors.flatMap(b => 
    b.thresholds.map(t => `  - p${t.percentile}: ${t.durationMs}ms`)
  ).join('\n');

  return `# k6 Load Tests

Generated from ISL specifications.

## Behaviors Tested
${behaviorList}

## SLA Thresholds
${thresholdList}

## Running Tests

\`\`\`bash
# Install k6: https://k6.io/docs/getting-started/installation/

# Run smoke test
npm run test:smoke

# Run load test
npm run test:load

# Run stress test
npm run test:stress

# Run spike test
npm run test:spike

# Run soak test
npm run test:soak

# Run all scenarios
npm run test:all

# With custom base URL
k6 run --env BASE_URL=https://api.example.com test.js
\`\`\`

## Reports

After running, reports are generated:
- \`summary.json\` - JSON summary
- \`summary.html\` - HTML report
`;
}

/**
 * Generate Artillery README
 */
function generateArtilleryReadme(behaviors: BehaviorSLA[]): string {
  const behaviorList = behaviors.map(b => `- ${b.name}`).join('\n');

  return `# Artillery Load Tests

Generated from ISL specifications.

## Behaviors Tested
${behaviorList}

## Running Tests

\`\`\`bash
# Install dependencies
npm install

# Run load test
npm test

# Run with report generation
npm run test:report
\`\`\`

## Configuration

Edit \`loadtest.yml\` to customize:
- Target URL
- Test phases
- Thresholds
`;
}

/**
 * Generate Gatling README
 */
function generateGatlingReadme(behaviors: BehaviorSLA[]): string {
  const behaviorList = behaviors.map(b => `- ${b.name}`).join('\n');

  return `# Gatling Load Tests

Generated from ISL specifications.

## Behaviors Tested
${behaviorList}

## Running Tests

\`\`\`bash
# Requires sbt and Scala

# Run all tests
sbt gatling:test

# Run specific simulation
sbt "gatling:testOnly loadtest.LoadTestSimulation"
\`\`\`

## Reports

Reports are generated in \`target/gatling/\` directory.
`;
}
