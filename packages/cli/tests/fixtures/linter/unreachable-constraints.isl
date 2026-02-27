domain TestDomain {
  version: "1.0.0"
  
  behavior TestBehavior {
    input {
      x: Int
    }
    
    pre {
      x == 0
    }
    
    post success {
      x == 1
    }
    
    output {
      success: Int
    }
  }
}
