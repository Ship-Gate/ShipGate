// Domain with CRUD behaviors
domain CrudOperations {
  version: "1.0.0"
  
  entity Product {
    id: UUID [immutable]
    name: String
    description: String?
    price: Decimal
    stock: Int
    active: Boolean
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  behavior CreateProduct {
    description: "Create a new product"
    input {
      name: String
      description: String?
      price: Decimal
      stock: Int?
    }
    output {
      success: Product
    }
  }
  
  behavior GetProduct {
    description: "Get product by ID"
    input {
      id: UUID
    }
    output {
      success: Product
    }
  }
  
  behavior UpdateProduct {
    description: "Update product details"
    input {
      id: UUID
      name: String?
      description: String?
      price: Decimal?
      stock: Int?
    }
    output {
      success: Product
    }
  }
  
  behavior DeleteProduct {
    description: "Delete a product"
    input {
      id: UUID
    }
    output {
      success: Boolean
    }
  }
  
  behavior ListProducts {
    description: "List all products"
    input {
      page: Int?
      limit: Int?
      active_only: Boolean?
    }
    output {
      success: List<Product>
    }
  }
}
