// Generic domain fixture: CRUD operations
domain Products {
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
      stock: Int
    }
    
    output {
      success: Product
      
      errors {
        INVALID_PRICE {
          when: "Price must be positive"
          retriable: false
        }
        DUPLICATE_NAME {
          when: "Product name already exists"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.name.length > 0
      input.price > 0
      input.stock >= 0
    }
    
    postconditions {
      success implies {
        Product.exists(result.id)
        Product.lookup(result.id).name == input.name
        Product.lookup(result.id).price == input.price
        Product.lookup(result.id).active == true
      }
    }
  }
  
  behavior UpdateProduct {
    description: "Update an existing product"
    
    input {
      product_id: UUID
      name: String?
      description: String?
      price: Decimal?
      stock: Int?
    }
    
    output {
      success: Product
      
      errors {
        PRODUCT_NOT_FOUND {
          when: "Product does not exist"
          retriable: false
        }
        INVALID_PRICE {
          when: "Price must be positive"
          retriable: false
        }
      }
    }
    
    preconditions {
      Product.exists(input.product_id)
      input.price == null or input.price > 0
    }
    
    postconditions {
      success implies {
        Product.lookup(input.product_id).updated_at > old(Product.lookup(input.product_id).updated_at)
      }
    }
  }
}
