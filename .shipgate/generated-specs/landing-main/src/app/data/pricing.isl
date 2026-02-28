# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PRICING_PLANS, PRICING_FAQ, CONTACT_EMAIL, SUPPORT_EMAIL, PlanId, PricingPlan, PricingFaqItem
# dependencies: lucide-react

domain Pricing {
  version: "1.0.0"

  type PlanId = String
  type PricingPlan = String
  type PricingFaqItem = String

  invariants exports_present {
    - true
  }
}
