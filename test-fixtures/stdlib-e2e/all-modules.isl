# End-to-End Test: All 10 Stdlib Modules
# This spec exercises all 10 stdlib modules in a realistic e-commerce scenario

domain EcommerceApp {
  version: "1.0.0"
  description: "E-commerce application using all 10 ISL stdlib modules"

  # ============================================
  # Import all 10 stdlib modules
  # ============================================

  # Original 5 modules
  use @isl/auth
  use @isl/rate-limit
  use @isl/audit
  use @isl/payments
  use @isl/uploads

  # New 5 modules
  use @isl/datetime
  use @isl/strings
  use @isl/crypto
  use @isl/uuid
  use @isl/json

  # ============================================
  # Types using stdlib types
  # ============================================

  type OrderStatus = enum {
    PENDING
    PROCESSING
    COMPLETED
    CANCELLED
    REFUNDED
  }

  # ============================================
  # Entities
  # ============================================

  entity User {
    id: UUID [immutable, unique]
    email: String { format: email }
    password_hash: String [secret]
    status: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    profile_image_url: String?
    metadata: JSONObject

    invariants {
      updated_at >= created_at
    }
  }

  entity Order {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    total: Decimal
    currency: String
    status: OrderStatus
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    payment_intent_id: String?
    items: JSONArray
    signature: String  # HMAC signature for integrity

    invariants {
      expires_at > created_at
      total >= 0
    }
  }

  entity ProductImage {
    id: UUID [immutable, unique]
    product_id: UUID [indexed]
    url: String
    mime_type: String
    file_hash: String
    uploaded_at: Timestamp [immutable]
  }

  # ============================================
  # Behaviors
  # ============================================

  # Uses: @isl/strings, @isl/crypto, @isl/uuid, @isl/datetime
  behavior RegisterUser {
    description: "Register a new user with email and password"

    input {
      email: String
      password: String { min_length: 8, sensitive: true }
      name: String
    }

    output {
      success: {
        user: User
        session_token: String [sensitive]
      }

      errors {
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password doesn't meet requirements"
          retriable: false
        }
      }
    }

    pre {
      # @isl/strings: Validate email format
      IsValidEmail(email)
      
      # @isl/strings: Validate password length
      Length(password) >= 8
      
      # @isl/strings: Validate name is not blank
      not IsBlank(name)
    }

    post success {
      # @isl/uuid: Valid UUID generated
      IsValidUUID(result.user.id)
      not IsNilUUID(result.user.id)
      
      # @isl/strings: Email normalized to lowercase
      result.user.email == ToLowerCase(Trim(input.email))
      
      # @isl/crypto: Password is hashed, not stored plain
      result.user.password_hash != input.password
      VerifyPassword(input.password, result.user.password_hash)
      
      # @isl/datetime: Timestamps set correctly
      result.user.created_at <= Now()
      result.user.updated_at == result.user.created_at
      
      # @isl/json: Metadata initialized as empty object
      Equals(result.user.metadata, EMPTY_OBJECT)
    }

    invariants {
      password never_logged
      password never_stored_plaintext
    }

    temporal {
      within 500ms (p99): response returned
      eventually within 5s: audit log updated
    }

    security {
      rate_limit 10 per minute per ip_address
    }
  }

  # Uses: @isl/strings, @isl/crypto, @isl/datetime, @isl/audit
  behavior LoginUser {
    description: "Authenticate user with email and password"

    input {
      email: String
      password: String [sensitive]
      ip_address: String
    }

    output {
      success: {
        session: Session
        token: String [sensitive]
        expires_at: Timestamp
      }

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
          retriable: false
        }
        USER_LOCKED {
          when: "Account locked due to failed attempts"
          retriable: false
        }
      }
    }

    pre {
      # @isl/strings: Validate email format
      IsValidEmail(email)
      Length(password) >= 8
    }

    post success {
      # @isl/crypto: Session token generated
      Length(result.token) >= 32
      
      # @isl/datetime: Session expires in future
      result.expires_at > Now()
      result.expires_at == AddDuration(Now(), DAY_MS)
    }

    temporal {
      eventually within 1s: audit log updated
    }

    security {
      rate_limit 5 per minute per ip_address
    }
  }

  # Uses: @isl/uuid, @isl/datetime, @isl/json, @isl/crypto, @isl/strings
  behavior CreateOrder {
    description: "Create a new order for a user"

    input {
      user_id: String
      items: List<{ product_id: String, quantity: Int, price: Decimal }>
      currency: String
    }

    output {
      success: Order

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        INVALID_ITEMS {
          when: "Items list is invalid"
          retriable: false
        }
        INVALID_CURRENCY {
          when: "Currency code is invalid"
          retriable: false
        }
      }
    }

    pre {
      # @isl/uuid: Validate user ID
      IsValidUUID(user_id)
      
      # @isl/strings: Validate currency code
      IsAlpha(currency)
      Length(currency) == 3
      
      # Validate items
      items.length > 0
      forall item in items: item.quantity > 0
    }

    post success {
      # @isl/uuid: Order ID generated
      IsValidUUID(result.id)
      
      # @isl/uuid: User ID matches
      UUIDsEqual(result.user_id, input.user_id)
      
      # @isl/strings: Currency normalized to uppercase
      result.currency == ToUpperCase(input.currency)
      
      # @isl/datetime: Timestamps set correctly
      result.created_at <= Now()
      result.expires_at == AddDuration(result.created_at, HOUR_MS * 24)
      
      # @isl/datetime: Order expires in future
      IsBefore(result.created_at, result.expires_at)
      
      # @isl/json: Items stored as JSON array
      IsArray(result.items)
      
      # @isl/crypto: Signature computed for integrity
      result.signature == Hmac(
        Stringify(result.items),
        ORDER_SIGNING_KEY,
        HMAC_SHA256
      )
    }

    temporal {
      within 200ms (p99): response returned
      eventually within 5s: audit log updated
    }
  }

  # Uses: @isl/uuid, @isl/datetime, @isl/payments
  behavior ProcessPayment {
    description: "Process payment for an order"

    input {
      order_id: String
      payment_method_id: String
    }

    output {
      success: {
        order: Order
        payment: Payment
        receipt_url: String
      }

      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
          retriable: false
        }
        ORDER_EXPIRED {
          when: "Order has expired"
          retriable: false
        }
        PAYMENT_FAILED {
          when: "Payment processing failed"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      # @isl/uuid: Validate order ID
      IsValidUUID(order_id)
      
      # @isl/datetime: Order not expired
      Order.lookup(order_id).expires_at > Now()
    }

    post success {
      # Order status updated
      result.order.status == COMPLETED
      
      # @isl/datetime: Completion time recorded
      result.order.updated_at <= Now()
      
      # @isl/strings: Receipt URL is valid
      IsValidUrl(result.receipt_url, require_https: true)
    }

    temporal {
      within 5s (p99): response returned
      eventually within 30s: payment webhook received
    }
  }

  # Uses: @isl/uuid, @isl/crypto, @isl/uploads, @isl/strings
  behavior UploadProductImage {
    description: "Upload an image for a product"

    input {
      product_id: String
      file_content: String { format: base64 }
      file_name: String
    }

    output {
      success: ProductImage

      errors {
        PRODUCT_NOT_FOUND {
          when: "Product does not exist"
          retriable: false
        }
        INVALID_FILE_TYPE {
          when: "File is not a valid image"
          retriable: false
        }
        FILE_TOO_LARGE {
          when: "File exceeds size limit"
          retriable: false
        }
      }
    }

    pre {
      # @isl/uuid: Validate product ID
      IsValidUUID(product_id)
      
      # @isl/strings: Validate base64 encoding
      MatchesPattern(file_content, "^[A-Za-z0-9+/]*={0,2}$")
      
      # @isl/strings: Validate file extension
      EndsWith(ToLowerCase(file_name), ".jpg") or
      EndsWith(ToLowerCase(file_name), ".jpeg") or
      EndsWith(ToLowerCase(file_name), ".png") or
      EndsWith(ToLowerCase(file_name), ".webp")
    }

    post success {
      # @isl/uuid: Image ID generated
      IsValidUUID(result.id)
      
      # @isl/crypto: File hash computed for integrity
      result.file_hash == HashSHA256(input.file_content)
      
      # @isl/datetime: Upload time recorded
      result.uploaded_at <= Now()
      
      # @isl/strings: URL is valid
      IsValidUrl(result.url)
    }
  }

  # Uses: @isl/json, @isl/crypto, @isl/datetime, @isl/strings
  behavior ProcessWebhook {
    description: "Process incoming webhook from payment provider"

    input {
      payload: String
      signature: String
      timestamp: String
    }

    output {
      success: {
        event_type: String
        processed: Boolean
      }

      errors {
        INVALID_SIGNATURE {
          when: "Webhook signature verification failed"
          retriable: false
        }
        INVALID_PAYLOAD {
          when: "Payload is not valid JSON"
          retriable: false
        }
        STALE_WEBHOOK {
          when: "Webhook timestamp is too old"
          retriable: false
        }
      }
    }

    pre {
      # @isl/json: Validate payload is valid JSON
      IsValid(payload)
      
      # @isl/crypto: Verify HMAC signature
      VerifyHmac(
        Concat([timestamp, ".", payload]),
        WEBHOOK_SECRET,
        signature,
        HMAC_SHA256
      )
      
      # @isl/strings: Timestamp is numeric
      IsNumeric(timestamp)
      
      # @isl/datetime: Webhook not too old (within 5 minutes)
      webhook_time = ParseTimestamp(timestamp, UNIX_SECONDS)
      DiffTimestamps(webhook_time, Now()) < MINUTE_MS * 5
    }

    post success {
      # @isl/json: Event type extracted
      data = Parse(input.payload)
      result.event_type == GetString(data, "$.type")
      
      result.processed == true
    }

    temporal {
      within 100ms (p99): response returned
      eventually within 5s: audit log updated
    }
  }

  # Uses: @isl/json, @isl/uuid, @isl/datetime
  behavior GetOrderDetails {
    description: "Get detailed order information including computed fields"

    input {
      order_id: String
      include_history: Boolean [default: false]
    }

    output {
      success: {
        order: Order
        time_remaining_ms: Duration?
        item_count: Int
        formatted_total: String
      }

      errors {
        ORDER_NOT_FOUND {
          when: "Order does not exist"
          retriable: false
        }
      }
    }

    pre {
      # @isl/uuid: Validate order ID
      IsValidUUID(order_id)
    }

    post success {
      # @isl/datetime: Calculate time remaining if not completed
      result.order.status == PENDING implies {
        result.time_remaining_ms == DiffTimestamps(Now(), result.order.expires_at)
        result.time_remaining_ms > 0
      }
      
      # @isl/json: Count items from JSON array
      items = GetArray(result.order, "$.items")
      result.item_count == items.length
      
      # @isl/strings: Format total with currency
      result.formatted_total == Concat([
        result.order.currency,
        " ",
        result.order.total.toString()
      ])
    }
  }

  # Uses: @isl/uuid - Deterministic UUID generation
  behavior GenerateIdempotencyKey {
    description: "Generate deterministic idempotency key from inputs"

    input {
      user_id: String
      action: String
      params: String
    }

    output {
      success: String
    }

    pre {
      # @isl/uuid: Validate user ID
      IsValidUUID(user_id)
      
      # @isl/strings: Validate action
      not IsBlank(action)
    }

    post success {
      # @isl/uuid: Generate deterministic UUID v5
      # Same inputs always produce same key
      result == GenerateUUIDv5(
        NAMESPACE_DNS,
        Join([input.user_id, input.action, input.params], ":")
      )
      
      # Key is valid UUID
      IsValidUUID(result)
    }
  }

  # ============================================
  # Constants
  # ============================================

  const ORDER_SIGNING_KEY: String = "order-signing-key-placeholder"
  const WEBHOOK_SECRET: String = "webhook-secret-placeholder"
}
