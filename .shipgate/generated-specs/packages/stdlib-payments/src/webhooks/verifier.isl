# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WebhookVerifier, WebhookSignatureMiddleware
# dependencies: crypto

domain Verifier {
  version: "1.0.0"

  type WebhookVerifier = String
  type WebhookSignatureMiddleware = String

  invariants exports_present {
    - true
  }
}
