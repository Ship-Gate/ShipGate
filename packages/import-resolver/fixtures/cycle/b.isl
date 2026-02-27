# Cycle test - B imports C

domain CycleTestB {
  version: "1.0.0"

  imports {
    EntityC from "./c.isl"
  }

  entity EntityB {
    id: UUID [immutable]
    name: String
  }
}
