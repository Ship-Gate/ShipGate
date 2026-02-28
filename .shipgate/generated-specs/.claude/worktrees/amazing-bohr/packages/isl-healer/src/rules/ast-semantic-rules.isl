# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runASTSemanticRules, getRule, auditRequiredRule, rateLimitRequiredRule, noPiiLoggingRule, noStubbedHandlersRule, AST_SEMANTIC_RULES, SemanticViolation, SemanticRule, SemanticRuleConfig, ExitPath, AuditCall, HandlerInfo
# dependencies: 

domain AstSemanticRules {
  version: "1.0.0"

  type SemanticViolation = String
  type SemanticRule = String
  type SemanticRuleConfig = String
  type ExitPath = String
  type AuditCall = String
  type HandlerInfo = String

  invariants exports_present {
    - true
  }
}
