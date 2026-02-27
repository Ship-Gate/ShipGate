/**
 * JSON reporter for structured output
 */

import { GateReport, Finding } from '../types.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { info } from '@actions/core';

/**
 * Save gate report as JSON
 */
export function saveJsonReport(
  report: GateReport,
  outputPath: string
): void {
  try {
    const fullPath = resolve(outputPath);
    const dir = dirname(fullPath);
    
    // Ensure directory exists
    mkdirSync(dir, { recursive: true });
    
    // Write report
    writeFileSync(fullPath, JSON.stringify(report, null, 2));
    info(`JSON report saved to: ${fullPath}`);
  } catch (error) {
    throw new Error(`Failed to save JSON report: ${error}`);
  }
}

/**
 * Convert gate runner result to JSON-serializable report
 */
export function createJsonReport(
  verdict: 'SHIP' | 'NO_SHIP',
  score: number,
  findings: Finding[],
  fingerprint?: string,
  durationMs?: number
): GateReport {
  // Count findings by severity
  const findingsBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  for (const finding of findings) {
    findingsBySeverity[finding.severity]++;
  }
  
  return {
    verdict,
    score,
    totalFindings: findings.length,
    findingsBySeverity,
    findings: findings.map(f => ({
      ...f,
      // Ensure all fields are serializable
      line: f.line || undefined,
      column: f.column || undefined,
    })),
    fingerprint,
    durationMs: durationMs || 0,
  };
}

/**
 * Generate SARIF report for GitHub security tab integration
 */
export function generateSarifReport(findings: Finding[]): any {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'ISL Gate',
          version: '1.0.0',
          informationUri: 'https://github.com/isl-lang/gate',
        },
      },
      results: findings.map(finding => ({
        ruleId: finding.ruleId,
        level: getSarifLevel(finding.severity),
        message: {
          text: finding.message,
        },
        locations: finding.filePath ? [{
          physicalLocation: {
            artifactLocation: {
              uri: finding.filePath,
            },
            region: finding.line ? {
              startLine: finding.line,
              startColumn: finding.column,
              endLine: finding.line,
              endColumn: finding.column,
            } : undefined,
          },
        }] : [],
      })),
    }],
  };
  
  return sarif;
}

/**
 * Convert finding severity to SARIF level
 */
function getSarifLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'note';
    default:
      return 'note';
  }
}
