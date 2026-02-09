domain TestDomain {
  version: "1.0.0"
  
  entity User {
    tags: List<String>
    scores: List<Int>
  }
  
  behavior GetUsers {
    input {
      tags: List<String>
    }
    output {
      success: List<User>
    }
  }
}
