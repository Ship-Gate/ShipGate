// E2E Test Generation Fixture: Collection Constraints
// Tests array/list constraint generation including sizes and unique items
domain CollectionFixture {
  version: "1.0.0"

  type Tag = String {
    min_length: 1
    max_length: 50
  }

  type ProductId = UUID

  entity Product {
    id: UUID [immutable, unique]
    name: String
    tags: List<Tag>
    related_products: List<ProductId>
    created_at: Timestamp [immutable]
  }

  entity Cart {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    items: List<CartItem>
    created_at: Timestamp [immutable]
  }

  type CartItem = {
    product_id: ProductId
    quantity: Int
    price: Decimal
  }

  behavior CreateProduct {
    description: "Create a product with tags"

    input {
      name: String
      tags: List<Tag>
      related_products: List<ProductId>
    }

    output {
      success: Product

      errors {
        INVALID_NAME {
          when: "Product name is invalid"
          retriable: false
        }
        TOO_MANY_TAGS {
          when: "Too many tags specified"
          retriable: true
        }
        INVALID_TAG {
          when: "Tag format is invalid"
          retriable: true
        }
      }
    }

    preconditions {
      input.name.length > 0
      input.tags.length <= 10
    }

    postconditions {
      success implies {
        Product.exists(result.id)
        Product.lookup(result.id).name == input.name
      }
    }
  }

  behavior AddToCart {
    description: "Add items to shopping cart"

    input {
      user_id: UUID
      items: List<CartItem>
    }

    output {
      success: Cart

      errors {
        EMPTY_CART {
          when: "Cart items list is empty"
          retriable: true
        }
        PRODUCT_NOT_FOUND {
          when: "Product does not exist"
          retriable: false
        }
        INVALID_QUANTITY {
          when: "Item quantity is invalid"
          retriable: true
        }
      }
    }

    preconditions {
      input.items.length > 0
      input.items.length <= 50
    }

    postconditions {
      success implies {
        Cart.exists(result.id)
      }
    }
  }
}
