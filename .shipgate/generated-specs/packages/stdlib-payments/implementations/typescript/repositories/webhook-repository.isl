# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WebhookEventRepository, InMemoryWebhookEventRepository
# dependencies: 

domain WebhookRepository {
  version: "1.0.0"

  type WebhookEventRepository = String
  type InMemoryWebhookEventRepository = String

  invariants exports_present {
    - true
  }
}
