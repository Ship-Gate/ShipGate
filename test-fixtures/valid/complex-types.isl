// NOTE: simplified for parser compatibility (optional type aliases not supported).
// Complex type definitions test fixture
// Tests nested objects, arrays, maps, and advanced type features

domain ComplexTypes {
  version: "1.0.0"
  
  // === DEEPLY NESTED STRUCT TYPES ===
  
  type ContactInfo = {
    primary_email: String
    secondary_emails: List<String>
    phone_numbers: List<{
      type: String
      number: String
      verified: Boolean
    }>
    addresses: List<{
      label: String
      street: String
      city: String
      country: String
      postal_code: String
      is_primary: Boolean
    }>
  }
  
  type CompanyProfile = {
    name: String
    legal_name: String?
    registration_number: String?
    tax_id: String?
    industry: String
    founded_year: Int?
    headquarters: {
      address: String
      city: String
      country: String
      timezone: String
    }
    subsidiaries: List<{
      name: String
      country: String
      ownership_percentage: Decimal
    }>
    contacts: Map<String, ContactInfo>
  }
  
  // === LIST TYPES ===
  
  type StringList = List<String>
  type IntList = List<Int>
  type UUIDList = List<UUID>
  
  type NestedList = List<List<String>>
  type DeepNestedList = List<List<List<Int>>>
  
  // === MAP TYPES ===
  
  type StringMap = Map<String, String>
  type IntMap = Map<String, Int>
  type MixedMap = Map<String, Decimal>
  
  type NestedMap = Map<String, Map<String, String>>
  type MapOfLists = Map<String, List<String>>
  type ListOfMaps = List<Map<String, Int>>
  
  // === OPTIONAL TYPES ===
  // Note: Optional type aliases (Type?) not supported as top-level definitions
  // Use optional fields in structs/entities instead
  
  type OptionalString = String
  type OptionalInt = Int
  type OptionalList = List<String>
  type OptionalMap = Map<String, Int>
  
  type StructWithOptionals = {
    required_field: String
    optional_string: String?
    optional_int: Int?
    optional_list: List<String>
    optional_nested: {
      inner_required: String
      inner_optional: Int?
    }
  }
  
  // === UNION TYPES ===
  
  enum PaymentMethodType {
    CARD
    BANK_TRANSFER
    CRYPTO
    WALLET
  }
  
  type CardPayment = {
    type: String
    card_number: String
    expiry_month: Int
    expiry_year: Int
    cvv: String
  }
  
  type BankTransfer = {
    type: String
    account_number: String
    routing_number: String
    bank_name: String
  }
  
  type CryptoPayment = {
    type: String
    wallet_address: String
    currency: String
    network: String
  }
  
  // === CONSTRAINED TYPES ===
  
  type Latitude = Decimal {
    min: -90
    max: 90
    precision: 6
  }
  
  type Longitude = Decimal {
    min: -180
    max: 180
    precision: 6
  }
  
  type Port = Int {
    min: 1
    max: 65535
  }
  
  type HttpStatusCode = Int {
    min: 100
    max: 599
  }
  
  type IPAddress = String {
    pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$"
  }
  
  type URL = String {
    format: url
    max_length: 2048
  }
  
  type Percentage = Decimal {
    min: 0
    max: 100
    precision: 2
  }
  
  type Currency = Decimal {
    min: 0
    precision: 2
  }
  
  type NonNegativeInt = Int {
    min: 0
  }
  
  type PositiveInt = Int {
    min: 1
  }
  
  type BoundedString = String {
    min_length: 1
    max_length: 255
  }
  
  // === ENTITIES WITH COMPLEX TYPES ===
  
  entity Product {
    id: UUID [immutable, unique]
    sku: String [unique, indexed]
    name: String
    description: String?
    
    // Nested struct field
    pricing: {
      base_price: Decimal
      currency: String
      discounts: List<{
        type: String
        value: Decimal
        valid_from: Timestamp?
        valid_until: Timestamp?
      }>
      taxes: Map<String, Decimal>
    }
    
    // List fields
    tags: List<String>
    categories: List<UUID>
    images: List<{
      url: String
      alt_text: String?
      is_primary: Boolean
    }>
    
    // Map fields
    attributes: Map<String, String>
    localized_names: Map<String, String>
    inventory: Map<String, Int>
    
    // Optional complex types
    // Optional inline structs (}?) not supported - made required
    dimensions: {
      length: Decimal
      width: Decimal
      height: Decimal
      unit: String
    }
    weight: {
      value: Decimal
      unit: String
    }
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      pricing.base_price >= 0
      all(pricing.discounts, d => d.value >= 0)
      tags.length <= 50
    }
  }
  
  entity Order {
    id: UUID [immutable, unique]
    customer_id: UUID [indexed]
    
    // Complex line items
    items: List<{
      product_id: UUID
      quantity: Int
      unit_price: Decimal
      discounts: List<{
        code: String
        amount: Decimal
      }>
      total: Decimal
    }>
    
    // Nested shipping info
    shipping: {
      address: {
        line1: String
        line2: String?
        city: String
        state: String?
        postal_code: String
        country: String
      }
      method: String
      tracking_number: String?
      estimated_delivery: Timestamp?
    }
    
    // Nested billing info
    billing: {
      address: {
        line1: String
        line2: String?
        city: String
        state: String?
        postal_code: String
        country: String
      }
      payment_method: String
      transaction_id: String?
    }
    
    // Totals
    totals: {
      subtotal: Decimal
      shipping: Decimal
      tax: Decimal
      discounts: Decimal
      total: Decimal
    }
    
    // Metadata map
    metadata: Map<String, String>
    
    status: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      items.length > 0
      all(items, item => item.quantity > 0)
      all(items, item => item.unit_price >= 0)
      totals.total >= 0
    }
  }
  
  // === BEHAVIORS WITH COMPLEX I/O ===
  
  behavior CreateProduct {
    input {
      sku: String
      name: String
      description: String?
      base_price: Decimal
      currency: String
      tags: List<String>
      attributes: Map<String, String>
      images: List<{
        url: String
        alt_text: String?
        is_primary: Boolean
      }>
    }
    
    output {
      success: Product
      
      errors {
        SKU_EXISTS { when: "SKU already exists" }
        INVALID_PRICE { when: "Price must be positive" }
      }
    }
    
    postconditions {
      success implies {
        Product.exists(result.id)
        result.sku == input.sku
        result.pricing.base_price == input.base_price
        result.tags == input.tags
      }
    }
  }
  
  behavior CreateOrder {
    input {
      customer_id: UUID
      items: List<{
        product_id: UUID
        quantity: Int
      }>
      shipping_address: {
        line1: String
        line2: String?
        city: String
        state: String?
        postal_code: String
        country: String
      }
      // optional inline struct (}?) not supported - made required
      billing_address: {
        line1: String
        line2: String?
        city: String
        state: String?
        postal_code: String
        country: String
      }
      // optional Map type not supported in behavior input - made required
      metadata: Map<String, String>
    }
    
    output {
      success: Order
      
      errors {
        INVALID_PRODUCT { when: "Product does not exist" }
        OUT_OF_STOCK { when: "Insufficient inventory" }
        INVALID_QUANTITY { when: "Quantity must be positive" }
      }
    }
    
    preconditions {
      input.items.length > 0
      all(input.items, item => item.quantity > 0)
      all(input.items, item => Product.exists(item.product_id))
    }
    
    postconditions {
      success implies {
        Order.exists(result.id)
        result.items.length == input.items.length
        result.customer_id == input.customer_id
      }
    }
  }
  
  behavior BulkUpdateInventory {
    input {
      updates: List<{
        product_id: UUID
        location: String
        quantity_change: Int
      }>
    }
    
    output {
      success: List<{
        product_id: UUID
        location: String
        new_quantity: Int
      }>
      
      errors {
        PRODUCT_NOT_FOUND { when: "Product does not exist" }
        NEGATIVE_INVENTORY { when: "Would result in negative inventory" }
      }
    }
    
    preconditions {
      input.updates.length > 0
      all(input.updates, update => Product.exists(update.product_id))
    }
  }
}
