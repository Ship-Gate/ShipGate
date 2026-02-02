// CRUD: Product catalog
domain CRUDProducts {
  version: "1.0.0"

  type Money = Decimal { min: 0, precision: 2 }

  enum ProductStatus {
    DRAFT
    ACTIVE
    ARCHIVED
    OUT_OF_STOCK
  }

  entity Product {
    id: UUID [immutable, unique]
    sku: String [unique, indexed]
    name: String
    slug: String [unique, indexed]
    description: String?
    price: Decimal
    compare_at_price: Decimal?
    currency: String [default: "USD"]
    status: ProductStatus [default: DRAFT]
    category_id: UUID? [indexed]
    brand: String?
    images: List<String>
    inventory_count: Int [default: 0]
    weight: Decimal?
    dimensions: { length: Decimal, width: Decimal, height: Decimal }?
    attributes: Map<String, String>
    tags: List<String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      name.length > 0
      price >= 0
      compare_at_price == null or compare_at_price >= price
      inventory_count >= 0
    }

    lifecycle {
      DRAFT -> ACTIVE
      ACTIVE -> ARCHIVED
      ACTIVE -> OUT_OF_STOCK
      OUT_OF_STOCK -> ACTIVE
      ARCHIVED -> ACTIVE
    }
  }

  behavior CreateProduct {
    description: "Create a product"

    actors {
      Admin { must: authenticated }
      Merchant { must: authenticated }
    }

    input {
      sku: String
      name: String
      description: String?
      price: Decimal
      compare_at_price: Decimal?
      category_id: UUID?
      brand: String?
      images: List<String>?
      inventory_count: Int?
      weight: Decimal?
      dimensions: { length: Decimal, width: Decimal, height: Decimal }?
      attributes: Map<String, String>?
      tags: List<String>?
    }

    output {
      success: Product

      errors {
        SKU_EXISTS {
          when: "SKU already exists"
          retriable: false
        }
        CATEGORY_NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
        INVALID_PRICE {
          when: "Price is invalid"
          retriable: true
        }
      }
    }

    pre {
      input.sku.length > 0
      input.name.length > 0
      input.price >= 0
      not Product.exists(sku: input.sku)
    }

    post success {
      - Product.exists(result.id)
      - result.sku == input.sku
      - result.status == DRAFT
    }
  }

  behavior GetProduct {
    description: "Get product by ID or slug"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      id: UUID?
      sku: String?
      slug: String?
    }

    output {
      success: Product

      errors {
        NOT_FOUND {
          when: "Product not found"
          retriable: false
        }
      }
    }

    pre {
      input.id != null or input.sku != null or input.slug != null
    }
  }

  behavior UpdateProduct {
    description: "Update a product"

    actors {
      Admin { must: authenticated }
      Merchant { must: authenticated }
    }

    input {
      id: UUID
      name: String?
      description: String?
      price: Decimal?
      compare_at_price: Decimal?
      category_id: UUID?
      brand: String?
      images: List<String>?
      weight: Decimal?
      dimensions: { length: Decimal, width: Decimal, height: Decimal }?
      attributes: Map<String, String>?
      tags: List<String>?
    }

    output {
      success: Product

      errors {
        NOT_FOUND {
          when: "Product not found"
          retriable: false
        }
        INVALID_PRICE {
          when: "Price is invalid"
          retriable: true
        }
      }
    }

    pre {
      Product.exists(input.id)
      input.price == null or input.price >= 0
    }

    post success {
      - result.updated_at > old(Product.lookup(input.id).updated_at)
    }
  }

  behavior UpdateInventory {
    description: "Update product inventory"

    actors {
      Admin { must: authenticated }
      System { }
    }

    input {
      id: UUID
      quantity: Int
      operation: String
    }

    output {
      success: Product

      errors {
        NOT_FOUND {
          when: "Product not found"
          retriable: false
        }
        INSUFFICIENT_INVENTORY {
          when: "Not enough inventory"
          retriable: false
        }
      }
    }

    pre {
      Product.exists(input.id)
      input.operation == "set" or input.operation == "increment" or input.operation == "decrement"
    }

    post success {
      - input.operation == "set" implies result.inventory_count == input.quantity
      - input.operation == "increment" implies result.inventory_count == old(Product.lookup(input.id).inventory_count) + input.quantity
    }
  }

  behavior DeleteProduct {
    description: "Delete a product"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Product not found"
          retriable: false
        }
        HAS_ORDERS {
          when: "Product has active orders"
          retriable: false
        }
      }
    }

    pre {
      Product.exists(input.id)
    }

    post success {
      - not Product.exists(input.id)
    }
  }

  behavior ListProducts {
    description: "List products"

    actors {
      Anonymous { }
    }

    input {
      category_id: UUID?
      brand: String?
      status: ProductStatus?
      min_price: Decimal?
      max_price: Decimal?
      tags: List<String>?
      search: String?
      page: Int?
      page_size: Int?
      sort_by: String?
    }

    output {
      success: {
        products: List<Product>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreateProduct {
    scenario "create with inventory" {
      when {
        result = CreateProduct(
          sku: "PROD-001",
          name: "Widget",
          price: 29.99,
          inventory_count: 100
        )
      }

      then {
        result is success
        result.inventory_count == 100
      }
    }
  }
}
