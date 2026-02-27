// Fixture: Circular import detection
// Expected Error: E0100 - Circular import detected
// Pass: import-graph

domain CircularImportTest {
  version: "1.0.0"

  // This creates a circular dependency if module-b imports module-a
  import TypeB from "./module-b.isl"

  entity EntityA {
    id: UUID [immutable]
    ref: TypeB
  }
}
