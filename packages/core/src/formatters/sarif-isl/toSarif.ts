/**
 * SARIF Output for ISL Clause Failures and Policy Violations
 *
 * Converts ISL Evidence Reports to SARIF 2.1.0 format for integration
 * with GitHub Code Scanning, VS Code SARIF Viewer, and other tools.
 *
 * @example
 * ```typescript
 * import { toSarif, toSarifString } from '@intentos/core/formatters/sarif-isl';
 *
 * const report: EvidenceReport = await verify(spec);
 * const sarif = toSarif(report);
 * const sarifJson = toSarifString(report, { prettyPrint: true });
 * ```
 */

import type { EvidenceReport, EvidenceClauseResult } from '../../evidence/evidenceTypes.js';
import type {
  SarifLog,
  SarifRun,
  SarifResult,
  SarifReportingDescriptor,
  SarifLocation,
  SarifLevel,
  SarifMessage,
  SarifInvocation,
  SarifArtifact,
  ToSarifOptions,
  IslClauseType,
  IslClauseState,
  IslBindingLocation,
  SarifPropertyBag,
} from './sarifTypes.js';

// =============================================================================
// Constants
// =============================================================================

/** SARIF JSON Schema URI */
const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

/** Tool information */
const TOOL_NAME = 'ISL Verifier';
const TOOL_VERSION = '1.0.0';
const TOOL_INFO_URI = 'https://github.com/intentos/isl';
const TOOL_ORGANIZATION = 'IntentOS';

/** Default options */
const DEFAULT_OPTIONS: Required<ToSarifOptions> = {
  failuresOnly: false,
  includePartial: true,
  includeRules: true,
  baseUri: '',
  toolVersion: TOOL_VERSION,
  includeArtifacts: false,
  prettyPrint: true,
};

// =============================================================================
// Mapping Functions
// =============================================================================

/**
 * Map ISL clause state to SARIF severity level
 */
function clauseStateToSarifLevel(state: IslClauseState): SarifLevel {
  switch (state) {
    case 'FAIL':
      return 'error';
    case 'PARTIAL':
      return 'warning';
    case 'PASS':
      return 'note';
    default:
      return 'note';
  }
}

/**
 * Map clause type to a category string
 */
function clauseTypeToCategory(type: IslClauseType | undefined): string {
  switch (type) {
    case 'precondition':
      return 'Precondition Violation';
    case 'postcondition':
      return 'Postcondition Violation';
    case 'invariant':
      return 'Invariant Violation';
    case 'effect':
      return 'Effect Violation';
    case 'constraint':
      return 'Constraint Violation';
    case 'policy':
      return 'Policy Violation';
    default:
      return 'Clause Failure';
  }
}

/**
 * Generate a rule ID from clause information
 * Format: ISL/<clauseType>/<clauseId>
 */
function generateRuleId(clause: EvidenceClauseResult): string {
  const type = clause.clauseType || 'clause';
  // Sanitize clauseId to be SARIF-safe (alphanumeric, dash, underscore, dot)
  const sanitizedId = clause.clauseId.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  return `ISL/${type}/${sanitizedId}`;
}

/**
 * Generate a short rule name from clause ID
 */
function generateRuleName(clause: EvidenceClauseResult): string {
  const type = clause.clauseType || 'clause';
  return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${clause.clauseId}`;
}

/**
 * Extract location information from clause result
 * Looks for location in metadata, bindings, or artifacts
 */
function extractLocation(
  clause: EvidenceClauseResult,
  specPath?: string
): IslBindingLocation | undefined {
  // Try to get location from clause metadata (if extended)
  const metadata = clause as EvidenceClauseResult & {
    location?: IslBindingLocation;
    binding?: { location?: IslBindingLocation };
  };

  if (metadata.location) {
    return metadata.location;
  }

  if (metadata.binding?.location) {
    return metadata.binding.location;
  }

  // Fall back to spec file if available
  if (specPath) {
    return { file: specPath };
  }

  return undefined;
}

/**
 * Build SARIF location from ISL binding location
 */
function buildSarifLocation(
  bindingLocation: IslBindingLocation,
  baseUri?: string
): SarifLocation {
  const uri = bindingLocation.file
    ? baseUri
      ? `${baseUri}/${bindingLocation.file}`.replace(/\/+/g, '/')
      : bindingLocation.file
    : undefined;

  const location: SarifLocation = {
    physicalLocation: {
      artifactLocation: uri ? { uri } : undefined,
      region:
        bindingLocation.line !== undefined
          ? {
              startLine: bindingLocation.line,
              startColumn: bindingLocation.column,
              endLine: bindingLocation.endLine,
              endColumn: bindingLocation.endColumn,
            }
          : undefined,
    },
  };

  // Add logical location if function/class info available
  if (bindingLocation.functionName || bindingLocation.className) {
    const logicalLocations = [];

    if (bindingLocation.functionName) {
      logicalLocations.push({
        name: bindingLocation.functionName,
        kind: 'function',
        fullyQualifiedName: bindingLocation.className
          ? `${bindingLocation.className}.${bindingLocation.functionName}`
          : bindingLocation.functionName,
      });
    }

    if (bindingLocation.className) {
      logicalLocations.push({
        name: bindingLocation.className,
        kind: 'type',
      });
    }

    return {
      ...location,
      logicalLocations,
    };
  }

  return location;
}

/**
 * Build message from clause result
 */
function buildMessage(clause: EvidenceClauseResult): SarifMessage {
  const parts: string[] = [];

  // Add clause state and type
  const category = clauseTypeToCategory(clause.clauseType);
  parts.push(`[${clause.state}] ${category}`);

  // Add clause ID
  parts.push(`Clause: ${clause.clauseId}`);

  // Add message if present
  if (clause.message) {
    parts.push(clause.message);
  }

  // Add actual vs expected if present
  if (clause.actualValue !== undefined || clause.expectedValue !== undefined) {
    if (clause.expectedValue !== undefined) {
      parts.push(`Expected: ${JSON.stringify(clause.expectedValue)}`);
    }
    if (clause.actualValue !== undefined) {
      parts.push(`Actual: ${JSON.stringify(clause.actualValue)}`);
    }
  }

  // Build markdown version
  const markdownParts: string[] = [];
  markdownParts.push(`**${category}**`);
  markdownParts.push(`\n\n**Clause ID:** \`${clause.clauseId}\``);
  markdownParts.push(`\n\n**Status:** ${clause.state}`);

  if (clause.message) {
    markdownParts.push(`\n\n${clause.message}`);
  }

  if (clause.actualValue !== undefined || clause.expectedValue !== undefined) {
    markdownParts.push('\n\n---\n');
    if (clause.expectedValue !== undefined) {
      markdownParts.push(`\n**Expected:** \`${JSON.stringify(clause.expectedValue)}\``);
    }
    if (clause.actualValue !== undefined) {
      markdownParts.push(`\n**Actual:** \`${JSON.stringify(clause.actualValue)}\``);
    }
  }

  if (clause.trace) {
    markdownParts.push(`\n\n**Trace:**\n\`\`\`\n${clause.trace}\n\`\`\``);
  }

  return {
    text: parts.join(' | '),
    markdown: markdownParts.join(''),
  };
}

/**
 * Build SARIF result from clause result
 */
function buildSarifResult(
  clause: EvidenceClauseResult,
  ruleIndex: number,
  specPath?: string,
  baseUri?: string
): SarifResult {
  const ruleId = generateRuleId(clause);
  const level = clauseStateToSarifLevel(clause.state as IslClauseState);
  const message = buildMessage(clause);

  const result: SarifResult = {
    ruleId,
    ruleIndex,
    level,
    message,
  };

  // Add location if available
  const bindingLocation = extractLocation(clause, specPath);
  if (bindingLocation) {
    const locations = [buildSarifLocation(bindingLocation, baseUri)];
    return { ...result, locations };
  }

  // Add fingerprint for deduplication
  const fingerprints: Record<string, string> = {
    clauseId: clause.clauseId,
  };

  // Add properties for additional context
  const properties: SarifPropertyBag = {
    clauseType: clause.clauseType,
    state: clause.state,
    tags: [clause.state, clause.clauseType || 'clause'].filter(Boolean),
  };

  if (clause.evaluationTimeMs !== undefined) {
    properties.evaluationTimeMs = clause.evaluationTimeMs;
  }

  if (clause.artifactIds?.length) {
    properties.artifactIds = clause.artifactIds;
  }

  return {
    ...result,
    fingerprints,
    properties,
  };
}

/**
 * Build SARIF rule descriptor from clause result
 */
function buildRuleDescriptor(clause: EvidenceClauseResult): SarifReportingDescriptor {
  const ruleId = generateRuleId(clause);
  const ruleName = generateRuleName(clause);
  const category = clauseTypeToCategory(clause.clauseType);

  return {
    id: ruleId,
    name: ruleName.replace(/\s+/g, ''),
    shortDescription: {
      text: category,
    },
    fullDescription: {
      text: `${category}: ${clause.clauseId}${clause.message ? ` - ${clause.message}` : ''}`,
    },
    helpUri: `https://intentos.dev/docs/clauses/${clause.clauseType || 'clause'}`,
    defaultConfiguration: {
      level: clauseStateToSarifLevel(clause.state as IslClauseState),
      enabled: true,
    },
    properties: {
      clauseType: clause.clauseType,
      category: clause.clauseType || 'clause',
    },
  };
}

/**
 * Build SARIF invocation from evidence metadata
 */
function buildInvocation(report: EvidenceReport): SarifInvocation {
  const { metadata, scoreSummary } = report;

  return {
    executionSuccessful: scoreSummary.failCount === 0,
    startTimeUtc: metadata.startedAt,
    endTimeUtc: metadata.completedAt,
    exitCode: scoreSummary.failCount > 0 ? 1 : 0,
    workingDirectory: report.specPath
      ? {
          uri: report.specPath.split('/').slice(0, -1).join('/') || '.',
        }
      : undefined,
  };
}

/**
 * Build SARIF artifacts from evidence artifacts
 */
function buildArtifacts(report: EvidenceReport): SarifArtifact[] {
  const artifacts: SarifArtifact[] = [];

  // Add spec file as artifact
  if (report.specPath) {
    artifacts.push({
      location: { uri: report.specPath },
      roles: ['analysisTarget'],
      mimeType: 'text/plain',
      sourceLanguage: 'isl',
    });
  }

  // Add evidence artifacts
  for (const artifact of report.artifacts) {
    artifacts.push({
      location: artifact.location ? { uri: artifact.location } : undefined,
      roles: [artifact.type],
      mimeType: artifact.mimeType,
      length: artifact.size,
      contents: artifact.content ? { text: artifact.content } : undefined,
    });
  }

  return artifacts;
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Convert an ISL Evidence Report to SARIF format
 *
 * @param report - The evidence report from ISL verification
 * @param options - Conversion options
 * @returns SARIF log object
 *
 * @example
 * ```typescript
 * const sarif = toSarif(evidenceReport, {
 *   failuresOnly: true,
 *   includeRules: true,
 * });
 * ```
 */
export function toSarif(
  report: EvidenceReport,
  options: ToSarifOptions = {}
): SarifLog {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter clauses based on options
  let filteredClauses = report.clauseResults;

  if (opts.failuresOnly) {
    filteredClauses = filteredClauses.filter(
      (c) => c.state === 'FAIL' || (opts.includePartial && c.state === 'PARTIAL')
    );
  } else if (!opts.includePartial) {
    filteredClauses = filteredClauses.filter((c) => c.state !== 'PARTIAL');
  }

  // Build rule descriptors (deduplicated by rule ID)
  const ruleMap = new Map<string, { descriptor: SarifReportingDescriptor; index: number }>();
  const rules: SarifReportingDescriptor[] = [];

  if (opts.includeRules) {
    for (const clause of filteredClauses) {
      const ruleId = generateRuleId(clause);
      if (!ruleMap.has(ruleId)) {
        const descriptor = buildRuleDescriptor(clause);
        ruleMap.set(ruleId, { descriptor, index: rules.length });
        rules.push(descriptor);
      }
    }
  }

  // Build results
  const results: SarifResult[] = filteredClauses.map((clause) => {
    const ruleId = generateRuleId(clause);
    const ruleInfo = ruleMap.get(ruleId);
    const ruleIndex = ruleInfo?.index ?? -1;
    return buildSarifResult(clause, ruleIndex, report.specPath, opts.baseUri);
  });

  // Build the run
  const run: SarifRun = {
    tool: {
      driver: {
        name: TOOL_NAME,
        version: opts.toolVersion,
        informationUri: TOOL_INFO_URI,
        organization: TOOL_ORGANIZATION,
        rules: opts.includeRules ? rules : undefined,
      },
    },
    results,
    invocations: [buildInvocation(report)],
    artifacts: opts.includeArtifacts ? buildArtifacts(report) : undefined,
  };

  // Add base URI if provided
  if (opts.baseUri) {
    run.originalUriBaseIds = {
      SRCROOT: { uri: opts.baseUri },
    };
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [run],
  };
}

/**
 * Convert an ISL Evidence Report to SARIF JSON string
 *
 * @param report - The evidence report from ISL verification
 * @param options - Conversion options
 * @returns SARIF JSON string
 *
 * @example
 * ```typescript
 * const sarifJson = toSarifString(evidenceReport);
 * fs.writeFileSync('results.sarif', sarifJson);
 * ```
 */
export function toSarifString(
  report: EvidenceReport,
  options: ToSarifOptions = {}
): string {
  const sarif = toSarif(report, options);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return JSON.stringify(sarif, null, opts.prettyPrint ? 2 : 0);
}

/**
 * Create a minimal SARIF result for a single clause failure
 *
 * @param clauseId - The clause identifier
 * @param message - Error message
 * @param clauseType - Type of clause
 * @param location - Optional location information
 * @returns SARIF result object
 */
export function createClauseFailureResult(
  clauseId: string,
  message: string,
  clauseType: IslClauseType = 'unknown',
  location?: IslBindingLocation
): SarifResult {
  const clause: EvidenceClauseResult = {
    clauseId,
    state: 'FAIL',
    message,
    clauseType,
  };

  return buildSarifResult(clause, -1, location?.file, '');
}

/**
 * Merge multiple SARIF logs into one
 *
 * @param logs - Array of SARIF logs to merge
 * @returns Merged SARIF log
 */
export function mergeSarifLogs(...logs: SarifLog[]): SarifLog {
  const allRuns: SarifRun[] = [];

  for (const log of logs) {
    allRuns.push(...log.runs);
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: allRuns,
  };
}
