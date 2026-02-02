# Deep import chain test

domain DeepMain {
  version: "1.0.0"

  imports {
    Level1Entity from "./level1.isl"
  }

  behavior UseAll {
    input {
      id: UUID
    }
    output {
      success: Level1Entity
    }
  }
}
