// File with unused imports for lint testing
domain UnusedImports {
  version: "1.0.0"

  // Import more than we use
  imports { Email, UserId, Status, Money, Address } from "./common-types"

  entity SimpleUser {
    id: UUID
    // Only uses Email from imports
    email: Email
    name: String
  }

  behavior GetSimpleUser {
    input {
      id: UUID
    }

    output {
      success: SimpleUser
    }
  }
}
