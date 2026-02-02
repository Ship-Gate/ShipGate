// Edge Case: Missing postconditions
// This spec intentionally has behaviors with weak/missing postconditions
// Used to test detection of incomplete specifications

domain EdgeMissingPostconditions {
  version: "1.0.0"

  entity Item {
    id: UUID [immutable, unique]
    name: String
    status: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  // WARNING: This behavior has no postconditions at all
  behavior CreateItemNoPost {
    description: "Create item - missing postconditions"

    actors {
      User { must: authenticated }
    }

    input {
      name: String
    }

    output {
      success: Item

      errors {
        INVALID_NAME {
          when: "Name is invalid"
          retriable: true
        }
      }
    }

    pre {
      input.name.length > 0
    }

    // NOTE: No postconditions defined - this should be flagged
  }

  // WARNING: Has postconditions but doesn't verify output
  behavior UpdateItemWeakPost {
    description: "Update item - weak postconditions"

    actors {
      User { must: authenticated }
    }

    input {
      id: UUID
      name: String?
      status: String?
    }

    output {
      success: Item

      errors {
        NOT_FOUND {
          when: "Item not found"
          retriable: false
        }
      }
    }

    pre {
      Item.exists(input.id)
    }

    post success {
      // Only checks timestamp, not that input was applied
      - result.updated_at >= now()
    }
  }

  // WARNING: Error postconditions missing
  behavior DeleteItemNoErrorPost {
    description: "Delete item - no error postconditions"

    actors {
      User { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Item not found"
          retriable: false
        }
        IN_USE {
          when: "Item is in use"
          retriable: false
        }
      }
    }

    pre {
      Item.exists(input.id)
    }

    post success {
      - not Item.exists(input.id)
    }

    // NOTE: No postconditions for NOT_FOUND or IN_USE errors
  }

  // WARNING: List behavior with no count verification
  behavior ListItemsNoCountPost {
    description: "List items - no pagination verification"

    actors {
      User { must: authenticated }
    }

    input {
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        items: List<Item>
        total_count: Int
        has_more: Boolean
      }
    }

    // NOTE: No postconditions to verify pagination correctness
  }

  scenarios CreateItemNoPost {
    scenario "create without verification" {
      when {
        result = CreateItemNoPost(name: "Test")
      }

      then {
        result is success
        // This scenario doesn't fully verify the created item
      }
    }
  }
}
