# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateProtoOptions, generateBufYaml, generateBufGenYaml, generateMethodOptions, CustomProtoOptions, BufYamlOptions, BufGenYamlOptions
# dependencies: google/protobuf/descriptor.proto

domain Options {
  version: "1.0.0"

  type CustomProtoOptions = String
  type BufYamlOptions = String
  type BufGenYamlOptions = String

  invariants exports_present {
    - true
  }
}
