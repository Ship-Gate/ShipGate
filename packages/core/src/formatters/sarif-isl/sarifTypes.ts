/**
 * SARIF Type Definitions for ISL Clause Failures
 *
 * Static Analysis Results Interchange Format (SARIF) 2.1.0
 * https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 *
 * These types are specific to ISL verification results, not generic SARIF.
 */

// =============================================================================
// Core SARIF Types
// =============================================================================

/**
 * Top-level SARIF log structure
 */
export interface SarifLog {
  /** JSON Schema URI */
  readonly $schema: string;
  /** SARIF version (always '2.1.0') */
  readonly version: '2.1.0';
  /** Array of analysis runs */
  readonly runs: SarifRun[];
}

/**
 * A single analysis run
 */
export interface SarifRun {
  /** Tool that performed the analysis */
  readonly tool: SarifTool;
  /** Analysis results (findings) */
  readonly results: SarifResult[];
  /** Invocation details */
  readonly invocations?: SarifInvocation[];
  /** Artifacts analyzed */
  readonly artifacts?: SarifArtifact[];
  /** Original URI base IDs */
  readonly originalUriBaseIds?: Record<string, SarifArtifactLocation>;
}

/**
 * Tool information
 */
export interface SarifTool {
  /** Driver (main tool component) */
  readonly driver: SarifToolComponent;
  /** Extension components */
  readonly extensions?: SarifToolComponent[];
}

/**
 * Tool component (driver or extension)
 */
export interface SarifToolComponent {
  /** Tool name */
  readonly name: string;
  /** Semantic version */
  readonly version: string;
  /** Tool information URI */
  readonly informationUri?: string;
  /** Rules defined by this tool */
  readonly rules?: SarifReportingDescriptor[];
  /** Organization name */
  readonly organization?: string;
}

/**
 * Rule/reporting descriptor
 */
export interface SarifReportingDescriptor {
  /** Unique rule ID (e.g., 'ISL/precondition-1') */
  readonly id: string;
  /** Rule name */
  readonly name?: string;
  /** Short description */
  readonly shortDescription?: SarifMessage;
  /** Full description */
  readonly fullDescription?: SarifMessage;
  /** Help URI */
  readonly helpUri?: string;
  /** Help text */
  readonly help?: SarifMessage;
  /** Default configuration */
  readonly defaultConfiguration?: SarifReportingConfiguration;
  /** Additional properties */
  readonly properties?: SarifPropertyBag;
}

/**
 * Rule configuration
 */
export interface SarifReportingConfiguration {
  /** Severity level */
  readonly level?: SarifLevel;
  /** Numeric rank (0-100) */
  readonly rank?: number;
  /** Whether rule is enabled */
  readonly enabled?: boolean;
}

/**
 * SARIF severity levels
 */
export type SarifLevel = 'none' | 'note' | 'warning' | 'error';

/**
 * Message with text and optional markdown
 */
export interface SarifMessage {
  /** Plain text message */
  readonly text: string;
  /** Markdown-formatted message */
  readonly markdown?: string;
  /** Message ID for localization */
  readonly id?: string;
  /** Arguments for message templates */
  readonly arguments?: string[];
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * A single analysis result (finding)
 */
export interface SarifResult {
  /** Rule ID that generated this result */
  readonly ruleId: string;
  /** Index into rules array */
  readonly ruleIndex?: number;
  /** Severity level */
  readonly level?: SarifLevel;
  /** Result message */
  readonly message: SarifMessage;
  /** Locations where issue was found */
  readonly locations?: SarifLocation[];
  /** Related locations for context */
  readonly relatedLocations?: SarifLocation[];
  /** Suggested fixes */
  readonly fixes?: SarifFix[];
  /** Additional properties */
  readonly properties?: SarifPropertyBag;
  /** Unique fingerprints for deduplication */
  readonly fingerprints?: Record<string, string>;
  /** Partial fingerprints */
  readonly partialFingerprints?: Record<string, string>;
  /** Code flows showing execution path */
  readonly codeFlows?: SarifCodeFlow[];
  /** Suppression status */
  readonly suppressions?: SarifSuppression[];
  /** Base line state */
  readonly baselineState?: 'new' | 'unchanged' | 'updated' | 'absent';
  /** Analysis target */
  readonly analysisTarget?: SarifArtifactLocation;
}

/**
 * Location information
 */
export interface SarifLocation {
  /** Physical location in a file */
  readonly physicalLocation?: SarifPhysicalLocation;
  /** Logical locations (function, class, etc.) */
  readonly logicalLocations?: SarifLogicalLocation[];
  /** Message for this location */
  readonly message?: SarifMessage;
  /** Unique ID within the result */
  readonly id?: number;
}

/**
 * Physical location in a file
 */
export interface SarifPhysicalLocation {
  /** Artifact (file) location */
  readonly artifactLocation?: SarifArtifactLocation;
  /** Region within the artifact */
  readonly region?: SarifRegion;
  /** Context region for display */
  readonly contextRegion?: SarifRegion;
}

/**
 * Artifact (file) location
 */
export interface SarifArtifactLocation {
  /** URI to the artifact */
  readonly uri?: string;
  /** Base ID for relative URIs */
  readonly uriBaseId?: string;
  /** Index into artifacts array */
  readonly index?: number;
  /** Description */
  readonly description?: SarifMessage;
}

/**
 * Region within a file
 */
export interface SarifRegion {
  /** Starting line (1-based) */
  readonly startLine?: number;
  /** Starting column (1-based) */
  readonly startColumn?: number;
  /** Ending line */
  readonly endLine?: number;
  /** Ending column */
  readonly endColumn?: number;
  /** Character offset from start */
  readonly charOffset?: number;
  /** Character length */
  readonly charLength?: number;
  /** Byte offset */
  readonly byteOffset?: number;
  /** Byte length */
  readonly byteLength?: number;
  /** Code snippet */
  readonly snippet?: SarifArtifactContent;
}

/**
 * Artifact content
 */
export interface SarifArtifactContent {
  /** Text content */
  readonly text?: string;
  /** Base64 binary content */
  readonly binary?: string;
  /** Rendered content */
  readonly rendered?: SarifMessage;
}

/**
 * Logical location (function, class, etc.)
 */
export interface SarifLogicalLocation {
  /** Short name */
  readonly name?: string;
  /** Fully qualified name */
  readonly fullyQualifiedName?: string;
  /** Decorated name */
  readonly decoratedName?: string;
  /** Kind (function, class, module, etc.) */
  readonly kind?: string;
  /** Parent index */
  readonly parentIndex?: number;
}

// =============================================================================
// Fix and Code Flow Types
// =============================================================================

/**
 * Suggested fix
 */
export interface SarifFix {
  /** Description of the fix */
  readonly description?: SarifMessage;
  /** Changes to apply */
  readonly artifactChanges: SarifArtifactChange[];
}

/**
 * Changes to an artifact
 */
export interface SarifArtifactChange {
  /** Artifact to change */
  readonly artifactLocation: SarifArtifactLocation;
  /** Replacements to make */
  readonly replacements: SarifReplacement[];
}

/**
 * Replacement operation
 */
export interface SarifReplacement {
  /** Region to delete */
  readonly deletedRegion: SarifRegion;
  /** Content to insert */
  readonly insertedContent?: SarifArtifactContent;
}

/**
 * Code flow showing execution path
 */
export interface SarifCodeFlow {
  /** Message for this flow */
  readonly message?: SarifMessage;
  /** Thread flows */
  readonly threadFlows: SarifThreadFlow[];
}

/**
 * Thread flow
 */
export interface SarifThreadFlow {
  /** Thread ID */
  readonly id?: string;
  /** Thread message */
  readonly message?: SarifMessage;
  /** Locations in the flow */
  readonly locations: SarifThreadFlowLocation[];
}

/**
 * Location in a thread flow
 */
export interface SarifThreadFlowLocation {
  /** Location */
  readonly location?: SarifLocation;
  /** Stack frame */
  readonly stack?: SarifStack;
  /** Kind of location */
  readonly kinds?: string[];
  /** Nesting level */
  readonly nestingLevel?: number;
  /** Execution order */
  readonly executionOrder?: number;
}

/**
 * Call stack
 */
export interface SarifStack {
  /** Stack frames */
  readonly frames: SarifStackFrame[];
  /** Message */
  readonly message?: SarifMessage;
}

/**
 * Stack frame
 */
export interface SarifStackFrame {
  /** Location */
  readonly location?: SarifLocation;
  /** Module */
  readonly module?: string;
  /** Thread ID */
  readonly threadId?: number;
}

// =============================================================================
// Invocation and Artifact Types
// =============================================================================

/**
 * Analysis invocation details
 */
export interface SarifInvocation {
  /** Whether execution succeeded */
  readonly executionSuccessful: boolean;
  /** Start time (ISO 8601) */
  readonly startTimeUtc?: string;
  /** End time (ISO 8601) */
  readonly endTimeUtc?: string;
  /** Exit code */
  readonly exitCode?: number;
  /** Tool notifications */
  readonly toolExecutionNotifications?: SarifNotification[];
  /** Tool configuration notifications */
  readonly toolConfigurationNotifications?: SarifNotification[];
  /** Working directory */
  readonly workingDirectory?: SarifArtifactLocation;
  /** Command line */
  readonly commandLine?: string;
  /** Arguments */
  readonly arguments?: string[];
}

/**
 * Notification from the tool
 */
export interface SarifNotification {
  /** Descriptor reference */
  readonly descriptor?: SarifReportingDescriptorReference;
  /** Message */
  readonly message: SarifMessage;
  /** Level */
  readonly level?: SarifLevel;
  /** Associated locations */
  readonly locations?: SarifLocation[];
  /** Exception */
  readonly exception?: SarifException;
}

/**
 * Reference to a reporting descriptor
 */
export interface SarifReportingDescriptorReference {
  /** Descriptor ID */
  readonly id?: string;
  /** Index into descriptors array */
  readonly index?: number;
  /** GUID */
  readonly guid?: string;
}

/**
 * Exception information
 */
export interface SarifException {
  /** Exception kind */
  readonly kind?: string;
  /** Exception message */
  readonly message?: string;
  /** Stack trace */
  readonly stack?: SarifStack;
  /** Inner exceptions */
  readonly innerExceptions?: SarifException[];
}

/**
 * Artifact (analyzed file)
 */
export interface SarifArtifact {
  /** Location */
  readonly location?: SarifArtifactLocation;
  /** Length in bytes */
  readonly length?: number;
  /** Roles (e.g., 'analysisTarget', 'resultFile') */
  readonly roles?: string[];
  /** MIME type */
  readonly mimeType?: string;
  /** Encoding */
  readonly encoding?: string;
  /** Contents */
  readonly contents?: SarifArtifactContent;
  /** Source language */
  readonly sourceLanguage?: string;
  /** Hashes */
  readonly hashes?: Record<string, string>;
}

/**
 * Result suppression
 */
export interface SarifSuppression {
  /** Suppression kind */
  readonly kind: 'inSource' | 'external';
  /** Status */
  readonly status?: 'accepted' | 'underReview' | 'rejected';
  /** Justification */
  readonly justification?: string;
  /** Location */
  readonly location?: SarifLocation;
}

/**
 * Property bag for extension data
 */
export interface SarifPropertyBag {
  /** Additional tags */
  readonly tags?: string[];
  /** Any additional properties */
  readonly [key: string]: unknown;
}

// =============================================================================
// ISL-Specific Types
// =============================================================================

/**
 * ISL clause types for categorization
 */
export type IslClauseType =
  | 'precondition'
  | 'postcondition'
  | 'invariant'
  | 'effect'
  | 'constraint'
  | 'policy'
  | 'unknown';

/**
 * ISL clause state
 */
export type IslClauseState = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Binding location from ISL verification
 */
export interface IslBindingLocation {
  /** File path */
  readonly file?: string;
  /** Line number (1-based) */
  readonly line?: number;
  /** Column number (1-based) */
  readonly column?: number;
  /** End line */
  readonly endLine?: number;
  /** End column */
  readonly endColumn?: number;
  /** Function or method name */
  readonly functionName?: string;
  /** Class name */
  readonly className?: string;
}

/**
 * Options for SARIF generation
 */
export interface ToSarifOptions {
  /** Include only FAIL results (default: true) */
  readonly failuresOnly?: boolean;
  /** Include PARTIAL results (default: true) */
  readonly includePartial?: boolean;
  /** Include rule definitions (default: true) */
  readonly includeRules?: boolean;
  /** Base URI for file paths */
  readonly baseUri?: string;
  /** Tool version override */
  readonly toolVersion?: string;
  /** Include artifacts (default: false) */
  readonly includeArtifacts?: boolean;
  /** Pretty print JSON (default: true) */
  readonly prettyPrint?: boolean;
}
