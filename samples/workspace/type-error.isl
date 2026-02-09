domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID @unique
    // Type error: InvalidType is not defined
    invalidField: InvalidType
    // Type error: String is misspelled
    name: Strng
    // Valid field
    email: String
  }

  behavior CreateUser {
    input {
      // Type error: UnknownType is not defined
      userId: UnknownType
      email: String
    }

    output {
      success: User
      // Type error: UserStatus enum doesn't exist
      errors {
        INVALID_STATUS {
          when: "Invalid status"
          retriable: false
        }
      }
    }

    preconditions {
      // Reference error: User entity doesn't have this method
      User.exists_by_invalid_field(input.email)
    }

    postconditions {
      success implies {
        // Reference error: result doesn't have invalidField
        result.invalidField == input.userId
      }
    }
  }
}
