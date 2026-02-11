/**
 * Annotations reporter for GitHub Check Runs
 */

import { CheckRunAnnotation } from '../types.js';
import { Finding } from '../types.js';

/**
 * Convert findings to GitHub check run annotations
 */
export function generateAnnotations(
  findings: Finding[],
  maxAnnotations: number = 50
): CheckRunAnnotation[] {
  // GitHub has a limit of 50 annotations per check run
  const annotations: CheckRunAnnotation[] = [];
  const sortedFindings = findings
    .sort((a, b) => {
      // Sort by severity first, then by blocking status
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (a.blocking !== b.blocking) {
        return b.blocking ? 1 : -1;
      }
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, maxAnnotations);

  for (const finding of sortedFindings) {
    const annotation = createAnnotation(finding);
    if (annotation) {
      annotations.push(annotation);
    }
  }

  return annotations;
}

/**
 * Create a single annotation from a finding
 */
function createAnnotation(finding: Finding): CheckRunAnnotation | null {
  if (!finding.filePath) {
    // Findings without file paths become general notices
    return {
      path: '.github',
      start_line: 1,
      end_line: 1,
      annotation_level: getAnnotationLevel(finding.severity),
      message: finding.message,
      title: `${finding.ruleId}: ${finding.severity}`,
    };
  }

  return {
    path: finding.filePath,
    start_line: finding.line || 1,
    end_line: finding.line || 1,
    start_column: finding.column,
    end_column: finding.column,
    annotation_level: getAnnotationLevel(finding.severity),
    message: finding.message,
    title: `${finding.ruleId}: ${finding.severity}`,
  };
}

/**
 * Convert finding severity to annotation level
 */
function getAnnotationLevel(severity: string): 'notice' | 'warning' | 'failure' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'failure';
    case 'medium':
      return 'warning';
    case 'low':
      return 'notice';
    default:
      return 'notice';
  }
}

/**
 * Generate check run output
 */
export function generateCheckRunOutput(
  title: string,
  summary: string,
  findings: Finding[]
): {
  title: string;
  summary: string;
  text?: string;
  annotations?: CheckRunAnnotation[];
} {
  const output = {
    title,
    summary,
    annotations: generateAnnotations(findings),
  };

  // Add detailed text if there are many findings
  if (findings.length > 50) {
    output.text = generateDetailedText(findings);
  }

  return output;
}

/**
 * Generate detailed text for findings that couldn't be annotated
 */
function generateDetailedText(findings: Finding[]): string {
  const nonAnnotated = findings.slice(50);
  
  let text = `## Additional Findings (${nonAnnotated.length})\n\n`;
  
  text += `| Severity | Rule | File | Message |\n`;
  text += `|----------|------|------|--------|\n`;
  
  for (const finding of nonAnnotated) {
    const severity = finding.severity.toUpperCase();
    const file = finding.filePath ? `${finding.filePath}:${finding.line || 0}` : 'N/A';
    const message = finding.message.length > 100 
      ? finding.message.substring(0, 97) + '...' 
      : finding.message;
    
    text += `| ${severity} | ${finding.ruleId} | ${file} | ${message} |\n`;
  }
  
  return text;
}
