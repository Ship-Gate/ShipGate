# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadProvenance, loadProvenanceSync, ENV_AI_TOOL, ENV_AI_MODEL, ENV_PROMPT_SHA, ENV_CONTEXT_SHA, PROVENANCE_TEMPLATE, AIProvenance
# dependencies: fs/promises, path

domain Provenance {
  version: "1.0.0"

  type AIProvenance = String

  invariants exports_present {
    - true
  }
}
