/**
 * Report Orchestrator
 *
 * Central entry point for generating verification reports in any format.
 * Coordinates between format-specific generators and handles file I/O.
 */

import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { generateMarkdownReport } from './markdownReport.js';
import { generateJsonReport } from './jsonReport.js';
import { generateHtmlReport } from './htmlReport.js';
import { generatePdfReport } from './pdfReport.js';
import type {
  ReportData,
  ReportOptions,
  ReportResult,
} from './reportTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a verification report in the specified format.
 *
 * @param data - The report data (produced from verification results)
 * @param options - Format, scope, output path, and feature toggles
 * @returns Result with success status, output path, and optional content
 */
export async function generateReport(
  data: ReportData,
  options: ReportOptions,
): Promise<ReportResult> {
  const {
    format,
    scope,
    outputPath,
    includeRecommendations,
    includeTrends,
    title,
    customCss,
  } = options;

  const formatOptions = {
    includeRecommendations,
    includeTrends,
    title,
    customCss,
  };

  try {
    switch (format) {
      case 'markdown':
        return await writeTextReport(
          generateMarkdownReport(data, scope, formatOptions),
          outputPath,
          'markdown',
        );

      case 'json':
        return await writeTextReport(
          generateJsonReport(data, scope),
          outputPath,
          'json',
        );

      case 'html':
        return await writeTextReport(
          generateHtmlReport(data, scope, formatOptions),
          outputPath,
          'html',
        );

      case 'pdf':
        return await generatePdfReport(data, outputPath, scope, formatOptions);

      default: {
        const exhaustive: never = format;
        return {
          success: false,
          format: exhaustive,
          error: `Unsupported report format: ${String(exhaustive)}`,
        };
      }
    }
  } catch (err) {
    return {
      success: false,
      format,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write text content to a file, creating directories as needed.
 * If outputPath is '-' or empty, return content without writing.
 */
async function writeTextReport(
  content: string,
  outputPath: string,
  format: ReportOptions['format'],
): Promise<ReportResult> {
  // stdout mode
  if (!outputPath || outputPath === '-') {
    return {
      success: true,
      format,
      content,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    };
  }

  // Write to file
  await mkdir(dirname(outputPath), { recursive: true });
  const buffer = Buffer.from(content, 'utf-8');
  await writeFile(outputPath, buffer);

  return {
    success: true,
    format,
    outputPath,
    content,
    sizeBytes: buffer.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter: Build ReportData from UnifiedVerifyResult
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for building ReportData from raw verification results.
 * Keeps the reporting module decoupled from CLI types.
 */
export interface BuildReportDataOptions {
  /** Repository URL or identifier */
  repository: string;
  /** Branch name */
  branch: string;
  /** Commit hash (short) */
  commit?: string;
  /** Historical trend data (optional) */
  trends?: Array<{
    date: string;
    coverage: number;
    score: number;
    label?: string;
  }>;
}

/**
 * Build ReportData from raw verification results.
 * This adapter keeps the reporting module decoupled from the CLI's
 * UnifiedVerifyResult type — it accepts a plain object.
 */
export function buildReportData(
  result: {
    verdict: string;
    score: number;
    coverage: { specced: number; total: number };
    files: Array<{
      file: string;
      status: string;
      mode: string;
      score: number;
      specFile?: string;
      blockers: string[];
      errors: string[];
      duration: number;
    }>;
    blockers: string[];
    recommendations: string[];
    mode: string;
    duration: number;
  },
  options: BuildReportDataOptions,
): ReportData {
  const passing = result.files.filter((f) => f.status === 'PASS').length;
  const warnings = result.files.filter((f) => f.status === 'WARN').length;
  const failures = result.files.filter((f) => f.status === 'FAIL').length;

  const coveragePercent =
    result.coverage.total > 0
      ? Math.round((result.coverage.specced / result.coverage.total) * 100)
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    verdict: result.verdict as ReportData['verdict'],
    score: result.score,
    repository: {
      repository: options.repository,
      branch: options.branch,
      commit: options.commit,
    },
    coverage: {
      totalFiles: result.coverage.total,
      specCoveredFiles: result.coverage.specced,
      coveragePercent,
      passingFiles: passing,
      warningFiles: warnings,
      failingFiles: failures,
    },
    files: result.files.map((f) => ({
      file: f.file,
      status: f.status as ReportData['files'][number]['status'],
      method: f.mode as ReportData['files'][number]['method'],
      score: f.score,
      specFile: f.specFile,
      blockers: f.blockers,
      finding: f.blockers.length > 0 ? f.blockers[0] : undefined,
      recommendation: undefined,
    })),
    mode: result.mode,
    duration: result.duration,
    blockers: result.blockers,
    recommendations: result.recommendations.map((text, i) => ({
      priority: i + 1,
      text,
    })),
    trends: options.trends,
  };
}
