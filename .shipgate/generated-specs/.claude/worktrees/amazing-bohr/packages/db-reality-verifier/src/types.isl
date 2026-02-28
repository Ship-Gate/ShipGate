# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DatabaseSchema, Table, Column, ForeignKey, Index, Relation, ExtractedQuery, Mismatch, VerificationResult, VerificationOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type DatabaseSchema = String
  type Table = String
  type Column = String
  type ForeignKey = String
  type Index = String
  type Relation = String
  type ExtractedQuery = String
  type Mismatch = String
  type VerificationResult = String
  type VerificationOptions = String

  invariants exports_present {
    - true
  }
}
