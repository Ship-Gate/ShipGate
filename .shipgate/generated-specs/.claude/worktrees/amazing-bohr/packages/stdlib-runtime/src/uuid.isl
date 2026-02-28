# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateUUID, generateUUIDv7, generateUUIDv5, generateUUIDv3, generateNamespacedUUID, isValidUUID, isNilUUID, isMaxUUID, parseUUID, formatUUID, normalizeUUID, getUUIDVersion, toComponents, fromComponents, compareUUIDs, uuidsEqual, NIL_UUID, MAX_UUID, NAMESPACE_DNS, NAMESPACE_URL, NAMESPACE_OID, NAMESPACE_X500, UUID_, UUID, UUIDVersion, UUIDNamespace, UUIDFormat, UUIDInfo, UUIDComponents
# dependencies: 

domain Uuid {
  version: "1.0.0"

  type UUID = String
  type UUIDVersion = String
  type UUIDNamespace = String
  type UUIDFormat = String
  type UUIDInfo = String
  type UUIDComponents = String

  invariants exports_present {
    - true
  }
}
