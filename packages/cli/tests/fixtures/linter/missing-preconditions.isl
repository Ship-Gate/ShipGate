domain TestDomain {
  version: "1.0.0"
  
  behavior CreateUser {
    input {
      email: String
    }
    
    output {
      success: String
    }
  }
}
