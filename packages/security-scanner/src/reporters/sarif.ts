// ============================================================================
// SARIF Reporter
// Static Analysis Results Interchange Format (SARIF) 2.1.0
// https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
// ============================================================================

import {
  ScanResult,
  Finding,
  Severity,
  SEVERITY_INFO,
  SecurityRule,
} from '../severity';
import { ALL_RULES } from '../rules';

// ============================================================================
// SARIF Types
// ============================================================================

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  invocations?: SarifInvocation[];
  artifacts?: SarifArtifact[];
}

interface SarifTool {
  driver: SarifToolComponent;
  extensions?: SarifToolComponent[];
}

interface SarifToolComponent {
  name: string;
  version: string;
  informationUri?: string;
  rules?: SarifReportingDescriptor[];
}

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: SarifMessage;
  fullDescription?: SarifMessage;
  helpUri?: string;
  help?: SarifMessage;
  defaultConfiguration?: SarifReportingConfiguration;
  properties?: SarifPropertyBag;
}

interface SarifReportingConfiguration {
  level?: 'none' | 'note' | 'warning' | 'error';
  rank?: number;
  enabled?: boolean;
}

interface SarifMessage {
  text: string;
  markdown?: string;
}

interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level?: 'none' | 'note' | 'warning' | 'error';
  message: SarifMessage;
  locations?: SarifLocation[];
  relatedLocations?: SarifLocation[];
  fixes?: SarifFix[];
  properties?: SarifPropertyBag;
}

interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
  logicalLocations?: SarifLogicalLocation[];
  message?: SarifMessage;
}

interface SarifPhysicalLocation {
  artifactLocation?: SarifArtifactLocation;
  region?: SarifRegion;
  contextRegion?: SarifRegion;
}

interface SarifArtifactLocation {
  uri?: string;
  uriBaseId?: string;
  index?: number;
}

interface SarifRegion {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  charOffset?: number;
  charLength?: number;
  byteOffset?: number;
  byteLength?: number;
  snippet?: SarifArtifactContent;
}

interface SarifArtifactContent {
  text?: string;
  binary?: string;
  rendered?: SarifMessage;
}

interface SarifLogicalLocation {
  name?: string;
  fullyQualifiedName?: string;
  kind?: string;
}

interface SarifFix {
  description?: SarifMessage;
  artifactChanges: SarifArtifactChange[];
}

interface SarifArtifactChange {
  artifactLocation: SarifArtifactLocation;
  replacements: SarifReplacement[];
}

interface SarifReplacement {
  deletedRegion: SarifRegion;
  insertedContent?: SarifArtifactContent;
}

interface SarifInvocation {
  executionSuccessful: boolean;
  startTimeUtc?: string;
  endTimeUtc?: string;
  exitCode?: number;
  toolExecutionNotifications?: SarifNotification[];
}

interface SarifNotification {
  descriptor?: SarifReportingDescriptorReference;
  message: SarifMessage;
  level?: 'none' | 'note' | 'warning' | 'error';
}

interface SarifReportingDescriptorReference {
  id?: string;
  index?: number;
}

interface SarifArtifact {
  location?: SarifArtifactLocation;
  length?: number;
  roles?: string[];
  mimeType?: string;
  encoding?: string;
}

interface SarifPropertyBag {
  [key: string]: unknown;
}

// ============================================================================
// SARIF Generation
// ============================================================================

const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const SARIF_VERSION = '2.1.0';
const TOOL_NAME = 'ISL Security Scanner';
const TOOL_VERSION = '1.0.0';
const TOOL_INFO_URI = 'https://github.com/intentos/security-scanner';

function severityToSarifLevel(severity: Severity): 'error' | 'warning' | 'note' {
  return SEVERITY_INFO[severity].sarifLevel;
}

function ruleToSarifDescriptor(rule: SecurityRule): SarifReportingDescriptor {
  const properties: SarifPropertyBag = {
    category: rule.category,
  };

  if (rule.cwe) {
    properties.cwe = rule.cwe;
  }
  if (rule.owasp) {
    properties.owasp = rule.owasp;
  }

  return {
    id: rule.id,
    name: rule.title.replace(/\s+/g, ''),
    shortDescription: {
      text: rule.title,
    },
    fullDescription: {
      text: rule.description,
    },
    helpUri: rule.cwe ? `https://cwe.mitre.org/data/definitions/${rule.cwe.replace('CWE-', '')}.html` : undefined,
    defaultConfiguration: {
      level: severityToSarifLevel(rule.severity),
      enabled: true,
    },
    properties,
  };
}

function findingToSarifResult(
  finding: Finding,
  ruleIndex: number,
  includeFixes: boolean
): SarifResult {
  const result: SarifResult = {
    ruleId: finding.id,
    ruleIndex,
    level: severityToSarifLevel(finding.severity),
    message: {
      text: finding.description,
      markdown: `**${finding.title}**\n\n${finding.description}\n\n**Recommendation:** ${finding.recommendation}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: finding.location.file,
          },
          region: {
            startLine: finding.location.startLine,
            startColumn: finding.location.startColumn,
            endLine: finding.location.endLine,
            endColumn: finding.location.endColumn,
          },
        },
      },
    ],
    properties: {
      severity: finding.severity,
      category: finding.category,
      cwe: finding.cwe,
      owasp: finding.owasp,
    },
  };

  // Add fix suggestion if available
  if (includeFixes && finding.fix) {
    result.fixes = [
      {
        description: {
          text: finding.recommendation,
        },
        artifactChanges: [
          {
            artifactLocation: {
              uri: finding.location.file,
            },
            replacements: [
              {
                deletedRegion: {
                  startLine: finding.location.startLine,
                  endLine: finding.location.endLine || finding.location.startLine,
                },
                insertedContent: {
                  text: finding.fix,
                },
              },
            ],
          },
        ],
      },
    ];
  }

  return result;
}

// ============================================================================
// Export Functions
// ============================================================================

export interface SarifOptions {
  includeFixes?: boolean;
  includeRules?: boolean;
  baseUri?: string;
}

/**
 * Generate SARIF report from scan results
 */
export function generateSarif(
  scanResult: ScanResult,
  options: SarifOptions = {}
): SarifLog {
  const { includeFixes = true, includeRules = true } = options;

  // Build rule index map
  const ruleIndexMap = new Map<string, number>();
  const usedRules: SecurityRule[] = [];

  for (const finding of scanResult.findings) {
    if (!ruleIndexMap.has(finding.id)) {
      const rule = ALL_RULES.find((r) => r.id === finding.id);
      if (rule) {
        ruleIndexMap.set(finding.id, usedRules.length);
        usedRules.push(rule);
      }
    }
  }

  // Build SARIF results
  const results: SarifResult[] = scanResult.findings.map((finding) => {
    const ruleIndex = ruleIndexMap.get(finding.id) ?? -1;
    return findingToSarifResult(finding, ruleIndex, includeFixes);
  });

  // Build SARIF rules
  const rules: SarifReportingDescriptor[] = includeRules
    ? usedRules.map(ruleToSarifDescriptor)
    : [];

  // Build SARIF log
  const sarifLog: SarifLog = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: TOOL_INFO_URI,
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: scanResult.scannedAt.toISOString(),
            endTimeUtc: new Date(
              scanResult.scannedAt.getTime() + scanResult.duration
            ).toISOString(),
          },
        ],
      },
    ],
  };

  return sarifLog;
}

/**
 * Generate SARIF report as JSON string
 */
export function generateSarifString(
  scanResult: ScanResult,
  options: SarifOptions = {}
): string {
  const sarif = generateSarif(scanResult, options);
  return JSON.stringify(sarif, null, 2);
}

/**
 * Generate SARIF with all rules (not just used ones)
 */
export function generateFullSarif(scanResult: ScanResult): SarifLog {
  const sarifLog: SarifLog = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: TOOL_INFO_URI,
            rules: ALL_RULES.map(ruleToSarifDescriptor),
          },
        },
        results: scanResult.findings.map((finding, index) =>
          findingToSarifResult(finding, index, true)
        ),
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: scanResult.scannedAt.toISOString(),
          },
        ],
      },
    ],
  };

  return sarifLog;
}
