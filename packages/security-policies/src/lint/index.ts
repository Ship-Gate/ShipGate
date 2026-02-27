// ============================================================================
// Security Lint - Public API
// ============================================================================

export {
  SecurityLintAnalyzer,
  createLintAnalyzer,
  lint,
} from './analyzer.js';

export {
  AutofixGenerator,
  createAutofixGenerator,
  generateFix,
  applyAllFixes,
  type TextEdit,
  type AutofixResult,
} from './autofix.js';

export {
  allLintRules,
  getLintRulesByCategory,
  getLintRuleById,
  authLintRules,
  authConstraintsRule,
  sessionSecurityRule,
  paymentLintRules,
  paymentConstraintsRule,
  paymentFraudCheckRule,
  pciComplianceRule,
  webhookLintRules,
  webhookConstraintsRule,
  webhookErrorHandlingRule,
  webhookResponseTimeRule,
} from './rules/index.js';
