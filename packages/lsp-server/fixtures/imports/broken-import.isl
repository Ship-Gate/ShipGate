// File with broken imports for testing error diagnostics
domain BrokenImports {
  version: "1.0.0"

  // Import from non-existent file
  imports { SomeType } from "./non-existent"

  // Import non-existent symbol from existing file
  imports { NonExistentType, Email } from "./common-types"

  entity TestEntity {
    id: UUID
    // Use imported type (one exists, one doesn't)
    email: Email
    other: NonExistentType
  }
}
