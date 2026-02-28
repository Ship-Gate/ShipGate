# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerSerializer, serializerRegistry, DefaultSerializerRegistry, ValidatingSerializer, CachingSerializer
# dependencies: 

domain Serializer {
  version: "1.0.0"

  type DefaultSerializerRegistry = String
  type ValidatingSerializer = String
  type CachingSerializer = String

  invariants exports_present {
    - true
  }
}
