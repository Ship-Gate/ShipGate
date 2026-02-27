# Cycle test - C imports A (creates cycle: A -> B -> C -> A)

domain CycleTestC {
  version: "1.0.0"

  imports {
    EntityA from "./a.isl"
  }

  entity EntityC {
    id: UUID [immutable]
    name: String
  }
}
