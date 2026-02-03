/**
 * test-project Domain
 * 
 * Define your intents and behaviors here.
 */

domain TestProject {
  /**
   * Example entity
   */
  entity User {
    id: ID
    name: String
    email: String
    createdAt: DateTime
  }

  /**
   * Example behavior
   */
  behavior CreateUser {
    input {
      name: String
      email: String
    }
    
    output User
    
    postconditions {
      ensure result.id != null
      ensure result.name == input.name
      ensure result.email == input.email
    }
    
    scenario "creates user with valid data" {
      given {
        name: "Alice"
        email: "alice@example.com"
      }
      then {
        result.name == "Alice"
        result.email == "alice@example.com"
      }
    }
  }
}
