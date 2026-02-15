# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findApplicableTemplates, getTemplateById, entityTemplates, behaviorTemplates, errorTemplates, securityTemplates, validationTemplates, allTemplates, SuggestionTemplate, TemplateContext
# dependencies: 

domain Templates {
  version: "1.0.0"

  type SuggestionTemplate = String
  type TemplateContext = String

  invariants exports_present {
    - true
  }
}
