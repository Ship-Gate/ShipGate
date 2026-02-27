# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: listProducts, getProduct, createProduct, updateProduct, deleteProduct, Product, CreateProductInput, UpdateProductInput, ListProductParams, ListProductResult
# dependencies: 

domain Product {
  version: "1.0.0"

  type Product = String
  type CreateProductInput = String
  type UpdateProductInput = String
  type ListProductParams = String
  type ListProductResult = String

  invariants exports_present {
    - true
  }
}
