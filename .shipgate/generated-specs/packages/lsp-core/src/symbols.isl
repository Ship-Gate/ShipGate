# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: IndexedSymbol, SymbolQuery, SymbolIndex
# dependencies: 

domain Symbols {
  version: "1.0.0"

  type IndexedSymbol = String
  type SymbolQuery = String
  type SymbolIndex = String

  invariants exports_present {
    - true
  }
}
