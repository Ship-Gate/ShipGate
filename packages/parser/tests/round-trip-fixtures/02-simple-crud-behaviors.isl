domain CrudBehaviors {
  version: "1.0.0"

  entity Item {
    id: UUID [immutable, unique]
    name: String
    status: String
  }

  behavior CreateItem {
    input {
      name: String
      status: String
    }
    output {
      success: Item
    }
    preconditions {
      - input.name.length > 0
    }
    postconditions {
      success implies {
        - Item.exists(result.id)
      }
    }
  }

  behavior UpdateItem {
    input {
      id: UUID
      name: String?
      status: String?
    }
    output {
      success: Item
    }
    preconditions {
      - Item.exists(input.id)
    }
  }
}
