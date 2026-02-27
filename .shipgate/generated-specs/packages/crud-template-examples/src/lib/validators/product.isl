# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createProductSchema, updateProductSchema, queryProductSchema, CreateProductInput, UpdateProductInput, QueryProductParams
# dependencies: zod

domain Product {
  version: "1.0.0"

  type CreateProductInput = String
  type UpdateProductInput = String
  type QueryProductParams = String

  invariants exports_present {
    - true
  }
}
