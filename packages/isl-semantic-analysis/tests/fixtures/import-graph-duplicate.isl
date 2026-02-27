// Fixture: Duplicate import detection
// Expected Warning: E0102 - Duplicate import
// Pass: import-graph

domain DuplicateImportTest {
  version: "1.0.0"

  import UserType from "./types.isl"
  import UserType from "./types.isl"  // E0102: Duplicate import

  entity User {
    id: UUID [immutable]
    type: UserType
  }
}
