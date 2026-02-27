# User Registration Specification
# All input must be validated

domain Registration version "1.0.0"

behavior RegisterUser {
  description: "Register a new user"
  
  input {
    email: Email
    name: String
  }
  
  output {
    success: { id: String }
    errors {
      InvalidEmail when "Email format invalid"
      EmptyName when "Name is empty"
    }
  }
  
  preconditions {
    - input.email.length > 0
    - input.email.contains("@")
    - input.name.length > 0
  }
}
