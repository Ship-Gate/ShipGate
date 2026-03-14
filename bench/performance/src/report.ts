import { cpus } from 'os';
import type { BenchmarkResult } from './runner.js';

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function generatePerformanceReport(results: BenchmarkResult[]): string {
  const timestamp = new Date().toISOString();
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const r of results) {
    const key = r.command;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  let md = `# ShipGate Performance Report\n\n`;
  md += `> Generated: ${timestamp}\n\n`;

  for (const [command, cmdResults] of grouped) {
    md += `## Command: \`${command}\`\n\n`;
    md += `| Project Size | Median | P95 | P99 | Min | Max | Stddev | Iterations |\n`;
    md += `| ------------ | ------ | --- | --- | --- | --- | ------ | ---------- |\n`;

    const sorted = [...cmdResults].sort((a, b) => a.projectSize - b.projectSize);

    for (const r of sorted) {
      const sd = stddev(r.timings);
      md += `| ${r.projectSize} files `;
      md += `| ${fmtMs(r.median)} `;
      md += `| ${fmtMs(r.p95)} `;
      md += `| ${fmtMs(r.p99)} `;
      md += `| ${fmtMs(r.min)} `;
      md += `| ${fmtMs(r.max)} `;
      md += `| ±${fmtMs(sd)} `;
      md += `| ${r.iterations} |\n`;
    }

    md += '\n';

    if (sorted.length >= 2) {
      md += `### Scaling Analysis\n\n`;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const sizeRatio = curr.projectSize / prev.projectSize;
        const timeRatio = curr.median / prev.median;
        const scalingFactor = timeRatio / sizeRatio;

        md += `- **${prev.projectSize} → ${curr.projectSize} files** `;
        md += `(${sizeRatio}x size): `;
        md += `${timeRatio.toFixed(2)}x slower `;
        md += `(scaling factor: ${scalingFactor.toFixed(2)}x — `;
        md += scalingFactor <= 1.2 ? 'linear ✓' : scalingFactor <= 2.0 ? 'slightly super-linear' : 'super-linear ⚠';
        md += `)\n`;
      }
      md += '\n';
    }
  }

  const cpuCount = cpus().length;
  md += `## Environment\n\n`;
  md += `- **Node.js**: ${process.version}\n`;
  md += `- **Platform**: ${process.platform} ${process.arch}\n`;
  md += `- **CPUs**: ${cpuCount} cores\n`;
  md += `- **Memory**: ${formatBytes(process.memoryUsage().heapTotal)}\n`;
  md += '\n';

  md += `## Notes\n\n`;
  md += `- All timings are wall-clock time (process.hrtime.bigint())\n`;
  md += `- First run is discarded as warmup\n`;
  md += `- Fixture projects contain realistic TypeScript files with models, services, routes, and utilities\n`;
  md += `- Some files contain intentional vulnerability patterns (SQL injection, hardcoded secrets) to test detection\n`;

  return md;
}

if (process.argv[1]?.endsWith('report.ts')) {
  const sampleResults: BenchmarkResult[] = [
    {
      command: 'npx shipgate gate --spec-optional --implementation src/',
      projectSize: 10,
      median: 850,
      p95: 920,
      p99: 950,
      min: 800,
      max: 960,
      iterations: 5,
      timings: [800, 830, 850, 870, 960],
    },
    {
      command: 'npx shipgate gate --spec-optional --implementation src/',
      projectSize: 100,
      median: 2400,
      p95: 2800,
      p99: 2900,
      min: 2100,
      max: 2950,
      iterations: 3,
      timings: [2100, 2400, 2950],
    },
    {
      command: 'npx shipgate gate --spec-optional --implementation src/',
      projectSize: 1000,
      median: 8500,
      p95: 9200,
      p99: 9500,
      min: 7800,
      max: 9600,
      iterations: 3,
      timings: [7800, 8500, 9600],
    },
  ];

  console.log(generatePerformanceReport(sampleResults));
}
