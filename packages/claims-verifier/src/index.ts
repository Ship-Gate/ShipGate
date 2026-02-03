// ============================================================================
// Claims Verification Agent
// Prevents generated copy from inventing numbers or claims
// ============================================================================

/**
 * @packageDocumentation
 * 
 * The Claims Verification Agent ensures that any numeric claim in documentation
 * or landing content can be traced to a verifiable source:
 * 
 * - Command output (e.g., `npx islstudio rules list`)
 * - Repository metadata (package.json, file counts)
 * - Explicitly provided user facts
 * 
 * ## Usage
 * 
 * ```typescript
 * import { ClaimsLinter, ClaimVerifier, AutoSoftener } from '@isl-lang/claims-verifier';
 * 
 * // Lint content for unverifiable claims
 * const linter = new ClaimsLinter({
 *   knownFacts: [
 *     { id: 'rules', description: 'Built-in rules', value: 25, unit: 'rules', source: { type: 'repo_metadata', filePath: 'docs/PRICING.md', description: 'Pricing docs' } }
 *   ]
 * });
 * 
 * const result = linter.lint(content, 'landing.tsx');
 * 
 * // Auto-soften unverifiable claims
 * if (result.issues.length > 0) {
 *   const softener = new AutoSoftener();
 *   const softened = softener.soften(content, result);
 *   console.log(softened.softened);
 * }
 * ```
 */

// Types
export type {
  Claim,
  ClaimLocation,
  ClaimSource,
  ClaimPattern,
  CommandOutputSource,
  RepoMetadataSource,
  UserProvidedSource,
  ComputedSource,
  KnownFact,
  LintResult,
  LintIssue,
  RefreshMethod,
  VerificationMethod,
  VerificationStatus,
  VerifierConfig,
} from './types.js';

// Extractor
export {
  ClaimExtractor,
  extractClaimsFromContent,
  extractClaimsFromLine,
  type ExtractorOptions,
} from './extractor.js';

// Patterns
export {
  DEFAULT_CLAIM_PATTERNS,
  HEDGE_PATTERNS,
  CONTEXTUAL_MARKERS,
  isHedged,
  isContextual,
} from './patterns.js';

// Verifier
export {
  ClaimVerifier,
  createDefaultFacts,
  type VerifierOptions,
  type VerificationResult,
} from './verifier.js';

// Linter
export {
  ClaimsLinter,
  formatLintResults,
  type LinterOptions,
} from './linter.js';

// Softener
export {
  AutoSoftener,
  softenContent,
  type SoftenOptions,
  type SoftenResult,
  type SoftenChange,
} from './softener.js';

// Utils
export {
  generateClaimId,
  normalizePath,
  extractNumber,
  formatNumber,
  stringSimilarity,
  valuesMatch,
  pluralize,
} from './utils.js';
