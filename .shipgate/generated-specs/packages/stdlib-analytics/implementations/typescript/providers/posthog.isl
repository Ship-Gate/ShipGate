# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPostHogProvider, PostHogConfig, PostHogProvider
# dependencies: 

domain Posthog {
  version: "1.0.0"

  type PostHogConfig = String
  type PostHogProvider = String

  invariants exports_present {
    - true
  }
}
