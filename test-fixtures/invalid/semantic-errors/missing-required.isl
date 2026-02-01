// Semantic error: missing required sections

domain MissingRequired {
  version: "1.0.0"
  
  // Entity without id field
  entity UserNoId {
    name: String
    email: String
  }
  
  // Behavior without input section
  behavior NoInput {
    output {
      success: Boolean
    }
  }
  
  // Behavior without output section
  behavior NoOutput {
    input {
      name: String
    }
  }
  
  // Scenario without then section
  behavior TestBehavior {
    input { value: Int }
    output { success: Boolean }
  }
  
  scenarios TestBehavior {
    scenario "missing then" {
      when {
        result = TestBehavior(value: 1)
      }
      // Missing then section
    }
  }
}
