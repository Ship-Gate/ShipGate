// Minimal ISL specification for build runner tests
domain Minimal {
  version: "1.0.0"
  
  entity Item {
    id: UUID [immutable, unique]
    name: String
  }
  
  behavior CreateItem {
    description: "Creates a new item"
    
    input {
      name: String
    }
    
    output {
      success: Item
      
      errors {
        INVALID_NAME {
          when: "Name is empty or too long"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.name.length > 0
      input.name.length <= 100
    }
    
    postconditions {
      success implies {
        result.name == input.name
      }
    }
  }
}
