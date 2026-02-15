# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, tryParse, stringify, stringifyPretty, stringifyCompact, get, getString, getNumber, getBoolean, getArray, getObject, has, set, remove, merge, clone, keys, values, entries, query, equals, diff, applyPatches, isValid, isObject, isArray, isString, isNumber, isBoolean, isNull, flatten, unflatten, pick, omit, EMPTY_OBJECT, EMPTY_ARRAY, NULL_VALUE, JSON_, JSONValue, JSONObject, JSONArray, JSONFormatOptions, JSONPatchOp, JSONParseResult, JSONPatch, JSONDiff
# dependencies: 

domain Json {
  version: "1.0.0"

  type JSONValue = String
  type JSONObject = String
  type JSONArray = String
  type JSONFormatOptions = String
  type JSONPatchOp = String
  type JSONParseResult = String
  type JSONPatch = String
  type JSONDiff = String

  invariants exports_present {
    - true
  }
}
