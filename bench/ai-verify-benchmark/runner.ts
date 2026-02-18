import fs from 'fs/promises';
import path from 'path';
import { runISLVerify } from './tools/run-isl-verify.js';
import { runESLint } from './tools/run-eslint.js';
import { runTSC } from './tools/run-tsc.js';
import { runSemgrep } from './tools/run-semgrep.js';
import { matchFindings } from './matcher/match-findings.js';
import { calculateMetrics, findUniqueToTool, categorizeUniqueIssues } from './metrics/calculate-metrics.js';
import { generateReport } from './reporter/generate-report.js';
import type { GroundTruth, BenchmarkResults, ToolResults, MatchResult } from './types.js';

interface RunnerOptions {
  projects?: string[];
  tools?: string[];
  verbose?: boolean;
}

const ALL_PROJECTS = [
  'p1-nextjs-todo',
  'p2-express-api',
  'p3-nextjs-ecommerce',
  'p4-fastify-microservice',
  'p5-nextjs-dashboard',
  'p6-express-mongodb',
  'p7-nextjs-saas-stripe',
  'p8-react-trpc',
  'p9-nextjs-blog-auth',
  'p10-express-prisma-api',
];

const ALL_TOOLS = ['isl-verify', 'eslint', 'tsc', 'semgrep'];

export async function runBenchmark(options: RunnerOptions = {}): Promise<BenchmarkResults> {
  const projectsToRun = options.projects || ALL_PROJECTS;
  const toolsToRun = options.tools || ALL_TOOLS;
  const verbose = options.verbose || false;

  console.log('🚀 ISL Verify Benchmark Starting...\n');
  console.log(`Projects: ${projectsToRun.length}`);
  console.log(`Tools: ${toolsToRun.join(', ')}\n`);

  const allGroundTruth: GroundTruth[] = [];
  const toolResultsMap = new Map<string, ToolResults[]>();

  for (const tool of toolsToRun) {
    toolResultsMap.set(tool, []);
  }

  for (const projectName of projectsToRun) {
    console.log(`\n📦 Running ${projectName}...`);
    
    const projectPath = path.join(process.cwd(), 'bench/ai-verify-benchmark/projects', projectName);
    
    // Load ground truth
    const groundTruthPath = path.join(projectPath, 'ground-truth.json');
    let groundTruth: GroundTruth;
    
    try {
      const content = await fs.readFile(groundTruthPath, 'utf-8');
      groundTruth = JSON.parse(content);
      allGroundTruth.push(groundTruth);
      console.log(`  ✓ Loaded ground truth: ${groundTruth.issues.length} issues`);
    } catch (error) {
      console.error(`  ✗ Failed to load ground truth: ${error}`);
      continue;
    }

    // Run each tool
    const projectMatches = new Map<string, MatchResult[]>();

    for (const tool of toolsToRun) {
      try {
        console.log(`  Running ${tool}...`);
        
        let findings;
        switch (tool) {
          case 'isl-verify':
            findings = await runISLVerify(projectPath);
            break;
          case 'eslint':
            findings = await runESLint(projectPath);
            break;
          case 'tsc':
            findings = await runTSC(projectPath);
            break;
          case 'semgrep':
            findings = await runSemgrep(projectPath);
            break;
          default:
            continue;
        }

        if (verbose) {
          console.log(`    Found ${findings.length} findings`);
        }

        // Match findings to ground truth
        const matches = matchFindings(findings, groundTruth.issues);
        projectMatches.set(tool, matches);

        // Calculate metrics
        const metrics = calculateMetrics(tool, matches, groundTruth.issues);
        toolResultsMap.get(tool)!.push(metrics);

        console.log(`    ✓ ${tool}: ${metrics.truePositives} TP, ${metrics.falsePositives} FP, ${metrics.falseNegatives} FN`);
        console.log(`      P: ${(metrics.precision * 100).toFixed(1)}%, R: ${(metrics.recall * 100).toFixed(1)}%, F1: ${metrics.f1.toFixed(2)}`);
      } catch (error) {
        console.error(`    ✗ ${tool} failed: ${error}`);
      }
    }
  }

  // Aggregate results
  console.log('\n\n📊 Aggregating Results...\n');

  const aggregatedResults: ToolResults[] = [];
  
  for (const [toolName, projectResults] of toolResultsMap.entries()) {
    if (projectResults.length === 0) continue;

    const totalTP = projectResults.reduce((sum, r) => sum + r.truePositives, 0);
    const totalFP = projectResults.reduce((sum, r) => sum + r.falsePositives, 0);
    const totalFN = projectResults.reduce((sum, r) => sum + r.falseNegatives, 0);

    const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
    const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    const allFindings = projectResults.flatMap(r => r.findings);
    const allMatches = projectResults.flatMap(r => r.matches);

    aggregatedResults.push({
      tool: toolName,
      findings: allFindings,
      matches: allMatches,
      truePositives: totalTP,
      falsePositives: totalFP,
      falseNegatives: totalFN,
      precision,
      recall,
      f1,
    });
  }

  // Find issues unique to ISL Verify
  const islVerifyResults = aggregatedResults.find(r => r.tool === 'isl-verify');
  const otherResults = aggregatedResults.filter(r => r.tool !== 'isl-verify');

  const uniqueToIslVerify = islVerifyResults
    ? findUniqueToTool(
        islVerifyResults.matches,
        otherResults.map(r => r.matches)
      )
    : [];

  const totalGroundTruthIssues = allGroundTruth.reduce((sum, gt) => sum + gt.issues.length, 0);

  const benchmarkResults: BenchmarkResults = {
    totalGroundTruthIssues,
    toolResults: aggregatedResults,
    uniqueToIslVerify,
    comparisonTable: buildComparisonTable(aggregatedResults),
    marketingClaims: generateMarketingClaims(aggregatedResults, uniqueToIslVerify, totalGroundTruthIssues),
  };

  return benchmarkResults;
}

function buildComparisonTable(results: ToolResults[]) {
  const getMetric = (tool: string, metric: keyof ToolResults) => {
    const result = results.find(r => r.tool === tool);
    if (!result) return 'N/A';
    
    const value = result[metric];
    if (typeof value === 'number') {
      if (metric === 'precision' || metric === 'recall') {
        return `${(value * 100).toFixed(0)}%`;
      }
      if (metric === 'f1') {
        return value.toFixed(2);
      }
      return value.toString();
    }
    return 'N/A';
  };

  return [
    {
      metric: 'Precision',
      islVerify: getMetric('isl-verify', 'precision'),
      eslint: getMetric('eslint', 'precision'),
      tsc: getMetric('tsc', 'precision'),
      semgrep: getMetric('semgrep', 'precision'),
    },
    {
      metric: 'Recall',
      islVerify: getMetric('isl-verify', 'recall'),
      eslint: getMetric('eslint', 'recall'),
      tsc: getMetric('tsc', 'recall'),
      semgrep: getMetric('semgrep', 'recall'),
    },
    {
      metric: 'F1',
      islVerify: getMetric('isl-verify', 'f1'),
      eslint: getMetric('eslint', 'f1'),
      tsc: getMetric('tsc', 'f1'),
      semgrep: getMetric('semgrep', 'f1'),
    },
  ];
}

function generateMarketingClaims(
  results: ToolResults[],
  uniqueToIsl: any[],
  totalIssues: number
): string[] {
  const claims: string[] = [];
  
  const islVerify = results.find(r => r.tool === 'isl-verify');
  const eslint = results.find(r => r.tool === 'eslint');
  const tsc = results.find(r => r.tool === 'tsc');
  const semgrep = results.find(r => r.tool === 'semgrep');

  if (islVerify && eslint) {
    const hallucinationMissed = Math.round((islVerify.recall - eslint.recall) * totalIssues);
    if (hallucinationMissed > 0) {
      claims.push(`Catches ${Math.round((islVerify.recall - eslint.recall) * 100)}% more issues than ESLint`);
    }
  }

  if (uniqueToIsl.length > 0) {
    claims.push(`Found ${uniqueToIsl.length} critical issues that NO other tool detected (${Math.round(uniqueToIsl.length / totalIssues * 100)}% of all issues)`);
    
    const categories = categorizeUniqueIssues(uniqueToIsl);
    for (const cat of categories.slice(0, 3)) {
      claims.push(`${cat.count} ${cat.subcategory} issues (unique to ISL Verify)`);
    }
  }

  if (islVerify) {
    claims.push(`${Math.round(islVerify.precision * 100)}% precision - minimal false positives`);
    claims.push(`${Math.round(islVerify.recall * 100)}% recall - finds most real issues`);
  }

  return claims;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options: RunnerOptions = {};
  
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      options.projects = [args[i + 1]];
      i++;
    } else if (args[i] === '--tools' && args[i + 1]) {
      options.tools = args[i + 1].split(',');
      i++;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    }
  }

  runBenchmark(options)
    .then(async (results) => {
      const report = await generateReport(results);
      
      const reportPath = path.join(process.cwd(), 'bench/ai-verify-benchmark/BENCHMARK_RESULTS.md');
      await fs.writeFile(reportPath, report);
      
      console.log(`\n\n✅ Benchmark complete!`);
      console.log(`📄 Report saved to: BENCHMARK_RESULTS.md\n`);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error);
      process.exit(1);
    });
}
