# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getTemplateBySlug, getTemplatesByTag, getTemplatesByCategory, searchTemplates, getAllTags, getAllCategories, getTemplateCounts, templateRegistry, TemplateQuestion, TemplateMetadata, TemplateCategory
# dependencies: 

domain Registry {
  version: "1.0.0"

  type TemplateQuestion = String
  type TemplateMetadata = String
  type TemplateCategory = String

  invariants exports_present {
    - true
  }
}
