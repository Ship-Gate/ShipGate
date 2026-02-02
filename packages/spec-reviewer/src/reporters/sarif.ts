/**
 * SARIF Reporter
 * 
 * Formats review results as SARIF (Static Analysis Results Interchange Format)
 * for integration with GitHub Code Scanning and other tools.
 */

import type { ReviewResult, Issue } from '../reviewer.js';

// SARIF types
interface SarifLog {
  version: '2.1.0';
  $schema: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  invocations: SarifInvocation[];
}

interface SarifTool {
  driver: SarifDriver;
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  help?: { text: string; markdown?: string };
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note' | 'none';
  };
  properties?: {
    category?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: SarifLocation[];
  fixes?: SarifFix[];
  properties?: Record<string, unknown>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
    };
  };
}

interface SarifFix {
  description: { text: string };
  artifactChanges: SarifArtifactChange[];
}

interface SarifArtifactChange {
  artifactLocation: { uri: string };
  replacements: SarifReplacement[];
}

interface SarifReplacement {
  deletedRegion: { startLine: number; startColumn?: number };
  insertedContent: { text: string };
}

interface SarifInvocation {
  executionSuccessful: boolean;
  endTimeUtc: string;
}

export interface SarifReporterOptions {
  specUri?: string;
  toolVersion?: string;
}

/**
 * Format review result as SARIF
 */
export function formatSarif(result: ReviewResult, options: SarifReporterOptions = {}): string {
  const {
    specUri = 'spec.isl',
    toolVersion = '0.1.0',
  } = options;

  // Build rules from issues
  const rules = buildRules(result.issues);
  
  // Build results from issues
  const results = buildResults(result.issues, specUri);

  const sarif: SarifLog = {
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'isl-spec-reviewer',
            version: toolVersion,
            informationUri: 'https://github.com/intentos/isl',
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: new Date().toISOString(),
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

/**
 * Build SARIF rules from issues
 */
function buildRules(issues: Issue[]): SarifRule[] {
  const rulesMap = new Map<string, SarifRule>();

  for (const issue of issues) {
    if (rulesMap.has(issue.id)) continue;

    const rule: SarifRule = {
      id: issue.id,
      name: issue.title,
      shortDescription: { text: issue.title },
      fullDescription: { text: issue.description },
      defaultConfiguration: {
        level: severityToLevel(issue.severity),
      },
      properties: {
        category: issue.category,
        tags: [issue.category, issue.severity],
      },
    };

    if (issue.fix) {
      rule.help = {
        text: `Fix: ${issue.fix}`,
        markdown: `**Fix:** ${issue.fix}`,
      };
    }

    rulesMap.set(issue.id, rule);
  }

  return Array.from(rulesMap.values());
}

/**
 * Build SARIF results from issues
 */
function buildResults(issues: Issue[], specUri: string): SarifResult[] {
  return issues.map(issue => {
    const result: SarifResult = {
      ruleId: issue.id,
      level: severityToLevel(issue.severity),
      message: { text: issue.description },
    };

    // Add location if available
    if (issue.location) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: specUri },
            region: {
              startLine: issue.location.line,
              startColumn: issue.location.column,
            },
          },
        },
      ];
    }

    // Add fix if available
    if (issue.fix && issue.location) {
      result.fixes = [
        {
          description: { text: issue.fix },
          artifactChanges: [
            {
              artifactLocation: { uri: specUri },
              replacements: [
                {
                  deletedRegion: {
                    startLine: issue.location.line,
                    startColumn: issue.location.column,
                  },
                  insertedContent: { text: `// ${issue.fix}` },
                },
              ],
            },
          ],
        },
      ];
    }

    return result;
  });
}

/**
 * Convert severity to SARIF level
 */
function severityToLevel(severity: string): 'error' | 'warning' | 'note' | 'none' {
  switch (severity) {
    case 'critical': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'note';
    default: return 'none';
  }
}

/**
 * Create SARIF for GitHub Code Scanning
 */
export function formatForGitHub(result: ReviewResult, options: SarifReporterOptions = {}): string {
  // GitHub has specific requirements, but standard SARIF works
  return formatSarif(result, options);
}

/**
 * Merge multiple SARIF reports
 */
export function mergeSarifReports(reports: string[]): string {
  const parsed = reports.map(r => JSON.parse(r) as SarifLog);
  
  if (parsed.length === 0) {
    throw new Error('No reports to merge');
  }

  const first = parsed[0];
  if (!first) {
    throw new Error('No reports to merge');
  }

  const merged: SarifLog = {
    version: '2.1.0',
    $schema: first.$schema,
    runs: [],
  };

  for (const sarif of parsed) {
    merged.runs.push(...sarif.runs);
  }

  return JSON.stringify(merged, null, 2);
}
