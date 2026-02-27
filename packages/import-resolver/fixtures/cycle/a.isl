# Cycle test - A imports B

domain CycleTestA {
  version: "1.0.0"

  imports {
    EntityB from "./b.isl"
  }

  entity EntityA {
    id: UUID [immutable]
    name: String
  }
}
