# Deep test - level 2

domain DeepLevel2 {
  version: "1.0.0"

  imports {
    Level3Entity from "./level3.isl"
  }

  entity Level2Entity {
    id: UUID [immutable]
    name: String
  }
}
