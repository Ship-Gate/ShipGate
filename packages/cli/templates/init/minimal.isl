/**
 * {{name}} Domain
 * 
 * A minimal ISL project template.
 */

domain {{pascalName}} {
  /**
   * Example entity
   */
  entity Item {
    id: ID
    name: String
    createdAt: DateTime
  }

  /**
   * Create a new item
   */
  behavior CreateItem {
    input {
      name: String
    }
    
    output Item
    
    postconditions {
      ensure result.id != null
      ensure result.name == input.name
    }
    
    scenario "creates item successfully" {
      given { name: "Test Item" }
      then {
        result.name == "Test Item"
      }
    }
  }
}
