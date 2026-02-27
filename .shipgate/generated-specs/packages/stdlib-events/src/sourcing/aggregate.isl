# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAggregate, ApplyFn, AggregateDefinition, Aggregate
# dependencies: 

domain Aggregate {
  version: "1.0.0"

  type ApplyFn = String
  type AggregateDefinition = String
  type Aggregate = String

  invariants exports_present {
    - true
  }
}
