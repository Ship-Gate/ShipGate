# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RoutingPattern, HeaderRoutingStrategy, PayloadRoutingStrategy, PriorityRoutingStrategy, RoundRobinRoutingStrategy, LeastLoadedRoutingStrategy, HashRoutingStrategy, RoutingBuilder
# dependencies: 

domain Routing {
  version: "1.0.0"

  type RoutingPattern = String
  type HeaderRoutingStrategy = String
  type PayloadRoutingStrategy = String
  type PriorityRoutingStrategy = String
  type RoundRobinRoutingStrategy = String
  type LeastLoadedRoutingStrategy = String
  type HashRoutingStrategy = String
  type RoutingBuilder = String

  invariants exports_present {
    - true
  }
}
