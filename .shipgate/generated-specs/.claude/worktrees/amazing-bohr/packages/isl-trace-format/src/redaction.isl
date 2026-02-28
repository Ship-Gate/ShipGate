# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: redactTraceData, redactWithConfig, containsSensitiveData, detectSensitivePatterns, partialMaskEmail, partialMaskId, redactHeaders, sanitizeInputs, sanitizeOutputs, sanitizeError, RedactionConfig, REDACTED_FIELDS, ALWAYS_REDACTED_FIELDS, PII_FIELDS, REDACTION_PATTERNS
# dependencies: 

domain Redaction {
  version: "1.0.0"

  type RedactionConfig = String

  invariants exports_present {
    - true
  }
}
