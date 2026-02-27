# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseJson, serializeJson, compareJson, compareJsonStrings, createJsonSerializer, createJsonComparator, JsonCompareOptions, DiffType, JsonDiff, JsonCompareResult
# dependencies: fast-deep-equal

domain Json {
  version: "1.0.0"

  type JsonCompareOptions = String
  type DiffType = String
  type JsonDiff = String
  type JsonCompareResult = String

  invariants exports_present {
    - true
  }
}
