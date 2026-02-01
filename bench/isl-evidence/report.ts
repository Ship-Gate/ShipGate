/**
 * ISL Evidence Bench Harness - Report Generation
 * 
 * Generates evidence reports from benchmark runs.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchConfig, SampleConfig } from './config.js';

// ============================================================================
// Types
// ============================================================================

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface StepResult {
  /** Name of the step */
  name: string;
  /** Status of the step */
  status: StepStatus;
  /** Start time (ISO string) */
  startedAt?: string;
  /** End time (ISO string) */
  completedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Output from the step */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Exit code if applicable */
  exitCode?: number;
}

export interface SampleResult {
  /** Sample ID */
  sampleId: string;
  /** Sample name */
  sampleName: string;
  /** Overall status */
  status: StepStatus;
  /** Individual step results */
  steps: {
    translate: StepResult;
    generate: StepResult;
    verify: StepResult;
  };
  /** Generated ISL content (if successful) */
  generatedIsl?: string;
  /** Generated TypeScript content (if successful) */
  generatedTs?: string;
  /** Trust score from verification */
  trustScore?: number;
  /** Tags from sample config */
  tags: string[];
}

export interface EvidenceReport {
  /** Report version */
  version: string;
  /** Timestamp when the report was generated */
  generatedAt: string;
  /** Overall summary */
  summary: {
    totalSamples: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDurationMs: number;
  };
  /** Configuration used */
  config: {
    timeouts: BenchConfig['timeouts'];
    verbose: boolean;
  };
  /** Individual sample results */
  samples: SampleResult[];
  /** Environment information */
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cwd: string;
  };
}

// ============================================================================
// Report Builder
// ============================================================================

export class ReportBuilder {
  private samples: Map<string, SampleResult> = new Map();
  private startTime: Date;
  private config: BenchConfig;

  constructor(config: BenchConfig) {
    this.config = config;
    this.startTime = new Date();
  }

  /**
   * Initialize a sample result
   */
  initSample(sample: SampleConfig): void {
    this.samples.set(sample.id, {
      sampleId: sample.id,
      sampleName: sample.name,
      status: 'pending',
      steps: {
        translate: { name: 'translate', status: 'pending' },
        generate: { name: 'generate', status: 'pending' },
        verify: { name: 'verify', status: 'pending' },
      },
      tags: sample.tags,
    });
  }

  /**
   * Start a step for a sample
   */
  startStep(sampleId: string, step: keyof SampleResult['steps']): void {
    const sample = this.samples.get(sampleId);
    if (sample) {
      sample.steps[step] = {
        ...sample.steps[step],
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      sample.status = 'running';
    }
  }

  /**
   * Complete a step for a sample
   */
  completeStep(
    sampleId: string,
    step: keyof SampleResult['steps'],
    result: Partial<StepResult>
  ): void {
    const sample = this.samples.get(sampleId);
    if (sample) {
      const now = new Date();
      const stepData = sample.steps[step];
      const startTime = stepData.startedAt ? new Date(stepData.startedAt) : now;
      
      sample.steps[step] = {
        ...stepData,
        ...result,
        completedAt: now.toISOString(),
        durationMs: now.getTime() - startTime.getTime(),
      };
    }
  }

  /**
   * Mark a sample as complete
   */
  completeSample(sampleId: string, additionalData?: Partial<SampleResult>): void {
    const sample = this.samples.get(sampleId);
    if (sample) {
      // Determine overall status based on step statuses
      const steps = Object.values(sample.steps);
      const hasFailed = steps.some(s => s.status === 'failed');
      const allPassed = steps.every(s => s.status === 'passed' || s.status === 'skipped');
      
      sample.status = hasFailed ? 'failed' : allPassed ? 'passed' : 'failed';
      
      if (additionalData) {
        Object.assign(sample, additionalData);
      }
    }
  }

  /**
   * Skip a sample
   */
  skipSample(sampleId: string, reason?: string): void {
    const sample = this.samples.get(sampleId);
    if (sample) {
      sample.status = 'skipped';
      for (const step of Object.keys(sample.steps) as Array<keyof SampleResult['steps']>) {
        sample.steps[step] = {
          ...sample.steps[step],
          status: 'skipped',
          output: reason,
        };
      }
    }
  }

  /**
   * Build the final report
   */
  build(): EvidenceReport {
    const samples = Array.from(this.samples.values());
    const endTime = new Date();
    
    const summary = {
      totalSamples: samples.length,
      passed: samples.filter(s => s.status === 'passed').length,
      failed: samples.filter(s => s.status === 'failed').length,
      skipped: samples.filter(s => s.status === 'skipped').length,
      totalDurationMs: endTime.getTime() - this.startTime.getTime(),
    };

    return {
      version: '1.0.0',
      generatedAt: endTime.toISOString(),
      summary,
      config: {
        timeouts: this.config.timeouts,
        verbose: this.config.verbose,
      },
      samples,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
      },
    };
  }
}

// ============================================================================
// Report Output
// ============================================================================

/**
 * Write report to JSON file
 */
export function writeReport(report: EvidenceReport, outputDir: string): string {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, 'evidence-report.json');
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  
  return outputPath;
}

/**
 * Print report summary to console
 */
export function printReportSummary(report: EvidenceReport): void {
  const { summary } = report;
  
  console.log('\n' + '='.repeat(60));
  console.log('ISL Evidence Report Summary');
  console.log('='.repeat(60));
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Duration:  ${(summary.totalDurationMs / 1000).toFixed(2)}s`);
  console.log('-'.repeat(60));
  console.log(`Total:     ${summary.totalSamples}`);
  console.log(`Passed:    ${summary.passed}`);
  console.log(`Failed:    ${summary.failed}`);
  console.log(`Skipped:   ${summary.skipped}`);
  console.log('-'.repeat(60));
  
  // Print individual sample results
  for (const sample of report.samples) {
    const statusIcon = sample.status === 'passed' ? '[PASS]' : 
                       sample.status === 'failed' ? '[FAIL]' : 
                       '[SKIP]';
    console.log(`${statusIcon} ${sample.sampleName} (${sample.sampleId})`);
    
    for (const [stepName, step] of Object.entries(sample.steps)) {
      const stepIcon = step.status === 'passed' ? '+' :
                       step.status === 'failed' ? 'x' :
                       step.status === 'skipped' ? '-' : '?';
      const duration = step.durationMs ? ` (${step.durationMs}ms)` : '';
      console.log(`  ${stepIcon} ${stepName}${duration}`);
      
      if (step.error) {
        console.log(`    Error: ${step.error}`);
      }
    }
    
    if (sample.trustScore !== undefined) {
      console.log(`  Trust Score: ${sample.trustScore}%`);
    }
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Generate a markdown report
 */
export function generateMarkdownReport(report: EvidenceReport): string {
  const lines: string[] = [];
  
  lines.push('# ISL Evidence Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  
  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Samples | ${report.summary.totalSamples} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  lines.push(`| Skipped | ${report.summary.skipped} |`);
  lines.push(`| Duration | ${(report.summary.totalDurationMs / 1000).toFixed(2)}s |`);
  lines.push('');
  
  // Sample details
  lines.push('## Sample Results');
  lines.push('');
  
  for (const sample of report.samples) {
    const statusEmoji = sample.status === 'passed' ? 'PASS' : 
                        sample.status === 'failed' ? 'FAIL' : 'SKIP';
    lines.push(`### ${sample.sampleName} [${statusEmoji}]`);
    lines.push('');
    lines.push(`- **ID**: ${sample.sampleId}`);
    lines.push(`- **Status**: ${sample.status}`);
    if (sample.trustScore !== undefined) {
      lines.push(`- **Trust Score**: ${sample.trustScore}%`);
    }
    lines.push('');
    
    lines.push('| Step | Status | Duration |');
    lines.push('|------|--------|----------|');
    for (const [stepName, step] of Object.entries(sample.steps)) {
      const duration = step.durationMs ? `${step.durationMs}ms` : '-';
      lines.push(`| ${stepName} | ${step.status} | ${duration} |`);
    }
    lines.push('');
  }
  
  // Environment
  lines.push('## Environment');
  lines.push('');
  lines.push(`- Node: ${report.environment.nodeVersion}`);
  lines.push(`- Platform: ${report.environment.platform}`);
  lines.push(`- Architecture: ${report.environment.arch}`);
  lines.push('');
  
  return lines.join('\n');
}
