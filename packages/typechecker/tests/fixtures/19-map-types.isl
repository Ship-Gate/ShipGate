domain TestDomain {
  version: "1.0.0"
  
  entity User {
    metadata: Map<String, String>
    scores: Map<String, Int>
  }
  
  behavior UpdateMetadata {
    input {
      userId: String
      metadata: Map<String, String>
    }
    output {
      success: User
    }
  }
}
