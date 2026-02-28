# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TemplateEngineOptions, TemplateEngine
# dependencies: 

domain TemplateEngine {
  version: "1.0.0"

  type TemplateEngineOptions = String
  type TemplateEngine = String

  invariants exports_present {
    - true
  }
}
