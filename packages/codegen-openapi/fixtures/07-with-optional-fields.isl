// Domain with optional fields
domain OptionalFields {
  version: "1.0.0"
  
  entity Profile {
    id: UUID [immutable]
    username: String
    display_name: String?
    bio: String?
    avatar_url: String?
    website: String?
    location: String?
    birth_date: Date?
    email: String
    phone: String?
    verified: Boolean
    created_at: Timestamp [immutable]
  }
  
  behavior CreateProfile {
    input {
      username: String
      email: String
      display_name: String?
      bio: String?
    }
    output {
      success: Profile
    }
  }
  
  behavior UpdateProfile {
    input {
      id: UUID
      display_name: String?
      bio: String?
      avatar_url: String?
      website: String?
      location: String?
      birth_date: Date?
      phone: String?
    }
    output {
      success: Profile
    }
  }
  
  behavior GetProfile {
    input {
      id: UUID
    }
    output {
      success: Profile
    }
  }
}
