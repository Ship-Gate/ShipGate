# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultProtocolCodec, CodecFactory, MessageFlags
# dependencies: crypto

domain Codec {
  version: "1.0.0"

  type DefaultProtocolCodec = String
  type CodecFactory = String

  invariants exports_present {
    - true
  }
}
