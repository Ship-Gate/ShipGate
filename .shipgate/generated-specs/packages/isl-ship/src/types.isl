# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveStack, toSnakeCase, toKebabCase, toCamelCase, islTypeToTS, islTypeToPrisma, DEFAULT_STACK, BackendFramework, DatabaseEngine, ORM, FrontendFramework, CSSFramework, ShipStack, ShipOptions, GeneratedFile, ShipResult, ShipStats
# dependencies: 

domain Types {
  version: "1.0.0"

  type BackendFramework = String
  type DatabaseEngine = String
  type ORM = String
  type FrontendFramework = String
  type CSSFramework = String
  type ShipStack = String
  type ShipOptions = String
  type GeneratedFile = String
  type ShipResult = String
  type ShipStats = String

  invariants exports_present {
    - true
  }
}
