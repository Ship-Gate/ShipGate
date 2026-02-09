domain TestDomain {
  version: "1.0.0"
  
  entity user {
    id: UUID
    UserName: String
    email_address: String
  }
  
  behavior createUser {
    input {
      Email: String
    }
    
    output {
      success: String
    }
  }
}
