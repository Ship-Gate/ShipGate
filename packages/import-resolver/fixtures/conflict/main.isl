# Conflict test - main imports two files with same entity name

domain ConflictTest {
  version: "1.0.0"

  imports {
    User from "./user-v1.isl"
    User from "./user-v2.isl"
  }

  behavior GetUser {
    input {
      id: UUID
    }
    output {
      success: User
    }
  }
}
