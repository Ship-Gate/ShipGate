# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createWebhookHandler, WebhookHandlerConfig
# dependencies: express

domain Webhooks {
  version: "1.0.0"

  type WebhookHandlerConfig = String

  invariants exports_present {
    - true
  }
}
