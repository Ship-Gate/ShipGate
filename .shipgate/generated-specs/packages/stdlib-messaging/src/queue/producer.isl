# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MessageProducer, ProducerBuilder
# dependencies: crypto

domain Producer {
  version: "1.0.0"

  type MessageProducer = String
  type ProducerBuilder = String

  invariants exports_present {
    - true
  }
}
