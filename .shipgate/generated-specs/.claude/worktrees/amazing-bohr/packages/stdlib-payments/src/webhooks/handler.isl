# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultWebhookHandlerRegistry, DefaultWebhookMiddlewareStack, DefaultWebhookLogger, DefaultWebhookMetricsCollector, PaymentIntentHandler, ChargeHandler, CheckoutSessionHandler, LoggingMiddleware, MetricsMiddleware, DeduplicationMiddleware
# dependencies: crypto

domain Handler {
  version: "1.0.0"

  type DefaultWebhookHandlerRegistry = String
  type DefaultWebhookMiddlewareStack = String
  type DefaultWebhookLogger = String
  type DefaultWebhookMetricsCollector = String
  type PaymentIntentHandler = String
  type ChargeHandler = String
  type CheckoutSessionHandler = String
  type LoggingMiddleware = String
  type MetricsMiddleware = String
  type DeduplicationMiddleware = String

  invariants exports_present {
    - true
  }
}
