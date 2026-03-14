import { generateProject, cleanup, type ProjectSize } from './fixture-generator.js';
import { generatePerformanceReport } from './report.js';
import { execSync } from 'child_process';

export interface BenchmarkResult {
  command: string;
  projectSize: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  iterations: number;
  timings: number[];
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export class BenchmarkRunner {
  private warmupRuns = 1;

  async runBenchmark(
    command: string,
    projectDir: string,
    iterations: number,
  ): Promise<BenchmarkResult> {
    const totalRuns = this.warmupRuns + iterations;
    const allTimings: number[] = [];

    for (let i = 0; i < totalRuns; i++) {
      const isWarmup = i < this.warmupRuns;
      const start = process.hrtime.bigint();

      try {
        execSync(command, {
          cwd: projectDir,
          stdio: 'pipe',
          timeout: 120_000,
          env: { ...process.env, NODE_ENV: 'production' },
        });
      } catch {
        // Command may fail (e.g., gate returns NO_SHIP exit code 1) — still measure time
      }

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;

      if (!isWarmup) {
        allTimings.push(durationMs);
      }

      if (isWarmup) {
        process.stdout.write('  [warmup] ');
      } else {
        process.stdout.write(`  [${i - this.warmupRuns + 1}/${iterations}] `);
      }
      process.stdout.write(`${durationMs.toFixed(1)}ms\n`);
    }

    const sorted = [...allTimings].sort((a, b) => a - b);

    const projectSize = (await import('fs/promises'))
      .then(fs => fs.readdir(projectDir, { recursive: true }))
      .then(files => files.length);

    return {
      command,
      projectSize: await projectSize,
      median: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      iterations,
      timings: allTimings,
    };
  }
}

interface BenchSuite {
  size: ProjectSize;
  commands: string[];
  iterations: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requestedSize = args.find(a => a.startsWith('--size='))?.split('=')[1]
    ?? args[args.indexOf('--size') + 1];

  const sizeMap: Record<string, ProjectSize> = {
    '10': 10, '100': 100, '1000': 1000, '10000': 10000,
  };

  const sizes: ProjectSize[] = requestedSize && sizeMap[requestedSize]
    ? [sizeMap[requestedSize]]
    : [10, 100, 1000];

  const iterationMap: Record<number, number> = {
    10: 5,
    100: 3,
    1000: 3,
    10000: 2,
  };

  const defaultCommands = [
    'npx shipgate gate --spec-optional --implementation src/',
  ];

  const suites: BenchSuite[] = sizes.map(size => ({
    size,
    commands: defaultCommands,
    iterations: iterationMap[size] ?? 3,
  }));

  const runner = new BenchmarkRunner();
  const allResults: BenchmarkResult[] = [];

  for (const suite of suites) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Generating ${suite.size}-file project...`);
    console.log('='.repeat(60));

    const project = await generateProject(suite.size);
    console.log(`  Created ${project.files.length} files in ${project.dir}`);

    for (const command of suite.commands) {
      console.log(`\n  Running: ${command}`);
      console.log(`  Iterations: ${suite.iterations} (+ 1 warmup)\n`);

      const result = await runner.runBenchmark(command, project.dir, suite.iterations);
      allResults.push(result);

      console.log(`\n  Results for ${suite.size}-file project:`);
      console.log(`    Median: ${result.median.toFixed(1)}ms`);
      console.log(`    P95:    ${result.p95.toFixed(1)}ms`);
      console.log(`    P99:    ${result.p99.toFixed(1)}ms`);
      console.log(`    Min:    ${result.min.toFixed(1)}ms`);
      console.log(`    Max:    ${result.max.toFixed(1)}ms`);
    }

    await cleanup(project.dir);
    console.log(`  Cleaned up ${project.dir}`);
  }

  console.log('\n\n');
  console.log(generatePerformanceReport(allResults));
}

main().catch((err: unknown) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

export { generateProject, cleanup };
