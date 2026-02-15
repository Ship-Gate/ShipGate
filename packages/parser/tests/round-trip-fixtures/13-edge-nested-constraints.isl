domain EdgeNested {
  version: "1.0.0"

  type NestedA = String {
    min_length: 1
    max_length: 100
  }

  type NestedB = NestedA {
    max_length: 50
  }

  type DeepStruct = {
    inner: {
      a: Int
      b: String?
    }
  }

  entity DeepEntity {
    id: UUID [immutable, unique]
    level1: {
      level2: {
        level3: Int
      }
    }
  }

  behavior SetDeep {
    input {
      id: UUID
      level3: Int
    }
    output {
      success: DeepEntity
    }
  }
}
