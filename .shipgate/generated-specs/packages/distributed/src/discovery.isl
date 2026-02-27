# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createServiceRegistry, createLoadBalancer, ServiceRegistry, InMemoryServiceRegistry, LoadBalancerStrategy, LoadBalancer
# dependencies: 

domain Discovery {
  version: "1.0.0"

  type ServiceRegistry = String
  type InMemoryServiceRegistry = String
  type LoadBalancerStrategy = String
  type LoadBalancer = String

  invariants exports_present {
    - true
  }
}
