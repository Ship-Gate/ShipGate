// Domain with nested and complex types
domain NestedTypes {
  version: "1.0.0"
  
  type Address = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
  }
  
  type GeoLocation = {
    latitude: Decimal
    longitude: Decimal
  }
  
  type ContactInfo = {
    email: String
    phone: String?
    address: Address?
  }
  
  type Metadata = {
    created_by: UUID
    created_at: Timestamp
    tags: List<String>
    properties: Map<String, String>
  }
  
  entity Company {
    id: UUID [immutable]
    name: String
    contact: ContactInfo
    location: GeoLocation?
    metadata: Metadata
  }
  
  behavior CreateCompany {
    input {
      name: String
      contact: ContactInfo
      location: GeoLocation?
    }
    output {
      success: Company
    }
  }
  
  behavior GetCompany {
    input {
      id: UUID
    }
    output {
      success: Company
    }
  }
}
