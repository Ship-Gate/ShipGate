# Deep test - level 1

domain DeepLevel1 {
  version: "1.0.0"

  imports {
    Level2Entity from "./level2.isl"
  }

  entity Level1Entity {
    id: UUID [immutable]
    name: String
  }
}
