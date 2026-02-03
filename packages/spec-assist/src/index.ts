/**
 * @isl-lang/spec-assist
 * 
 * AI-assisted ISL spec generation from existing code.
 * 
 * SAFETY GUARANTEES:
 * - AI cannot directly ship code
 * - All AI output is validated by parser + semantic + verifier
 * - Must be explicitly enabled via feature flag
 * - Non-ISL output ("slop") is rejected
 * 
 * @example
 * ```typescript
 * import { createSpecAssist, generateSpecFromCode } from '@isl-lang/spec-assist';
 * 
 * // Quick usage
 * const result = await generateSpecFromCode(
 *   'function createUser(email, password) { ... }',
 *   'typescript'
 * );
 * 
 * if (result.success) {
 *   console.log(result.isl);
 * } else {
 *   console.log(result.diagnostics);
 * }
 * 
 * // Advanced usage
 * const service = createSpecAssist({ provider: 'anthropic' });
 * await service.initialize();
 * const result = await service.generateSpec({
 *   code: '...',
 *   language: 'typescript',
 *   signature: 'createUser',
 *   hints: ['handles user registration', 'sends verification email'],
 * });
 * ```
 */

// Main service
export {
  SpecAssistService,
  createSpecAssist,
  generateSpecFromCode,
  isSpecAssistAvailable,
} from './spec-assist.js';

// Types
export type {
  SpecAssistConfig,
  SpecAssistRequest,
  SpecAssistResponse,
  ValidationResult,
  ParseError,
  SemanticError,
  VerifyIssue,
  Diagnostic,
  ChatMessage,
  CompletionOptions,
  FeatureFlagConfig,
  AIOutputEnvelope,
} from './types.js';

export { isValidOutput } from './types.js';

// Providers
export {
  type AIProvider,
  type ProviderResponse,
  BaseProvider,
  StubProvider,
  AnthropicProvider,
  createProvider,
  createStubProvider,
  createAnthropicProvider,
} from './providers/index.js';

// Validation
export {
  validateISL,
  toDiagnostics,
} from './validator.js';

// Feature flags
export {
  isAIEnabled,
  requireAIEnabled,
  getDefaultConfig,
  AI_ENABLED_ENV,
  AI_PROVIDER_ENV,
  CONFIG_FILE,
} from './feature-flag.js';

// Test utilities
export { INVALID_OUTPUTS } from './providers/stub.js';
