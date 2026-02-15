# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: listTemplates, getTemplate, spec, printSpecResult, getSpecExitCode, TEMPLATES, SpecOptions, SpecResult, TemplateInfo
# dependencies: fs/promises, path, chalk, ora

domain Spec {
  version: "1.0.0"

  type SpecOptions = String
  type SpecResult = String
  type TemplateInfo = String

  invariants exports_present {
    - true
  }
}
