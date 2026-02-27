# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CachedTemplate, TemplateCacheOptions, TemplateCache
# dependencies: fs/promises, path, fs

domain TemplateCache {
  version: "1.0.0"

  type CachedTemplate = String
  type TemplateCacheOptions = String
  type TemplateCache = String

  invariants exports_present {
    - true
  }
}
