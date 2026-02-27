domain CompletionTest {
  version: "1.0.0"

  // Try typing here: entity, behavior, type, enum
  // Completion should suggest these keywords

  entity TestEntity {
    // Try typing here: id, invariants, lifecycle
    // Completion should suggest entity keywords
  }

  behavior TestBehavior {
    // Try typing here: input, output, preconditions, postconditions
    // Completion should suggest behavior keywords

    input {
      // Try typing here: param: <Ctrl+Space>
      // Completion should suggest built-in types: String, Int, UUID, etc.
    }

    output {
      success: Boolean
    }

    preconditions {
      // Try typing here: forall, exists, implies, and, or
      // Completion should suggest expression keywords
    }

    postconditions {
      // Try typing here: old, result, success, failure
      // Completion should suggest postcondition keywords
    }
  }
}
