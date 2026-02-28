# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEvidenceResolver, ResolverConfig, EvidenceResolver
# dependencies: fs/promises, path

domain EvidenceResolver {
  version: "1.0.0"

  type ResolverConfig = String
  type EvidenceResolver = String

  invariants exports_present {
    - true
  }
}
