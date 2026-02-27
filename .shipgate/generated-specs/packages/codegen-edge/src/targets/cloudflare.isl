# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateCloudflare, handle, onRequest, onRequestPost, Env, EntityStore
# dependencies: itty-router

domain Cloudflare {
  version: "1.0.0"

  type Env = String
  type EntityStore = String

  invariants exports_present {
    - true
  }
}
