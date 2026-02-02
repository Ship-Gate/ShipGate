// NOTE: simplified for parser compatibility (view/policy/invariants syntax).
// Edge case: Empty blocks and minimal content

domain EmptyBlocks {
  version: "1.0.0"
  
  // Empty type constraints
  type NoConstraints = String { }
  
  // Entity with only id
  entity MinimalEntity {
    id: UUID [immutable, unique]
  }
  
  // Entity with empty invariants block
  entity EmptyInvariants {
    id: UUID
    name: String
    
    invariants { }
  }
  
  // Entity with empty lifecycle
  entity EmptyLifecycle {
    id: UUID
    status: String
    
    lifecycle { }
  }
  
  // Empty enum (edge case - might be invalid)
  // enum EmptyEnum { }
  
  // Enum with single variant
  enum SingleVariant {
    ONLY_ONE
  }
  
  // Behavior with minimal content
  behavior MinimalBehavior {
    input { }
    output { success: Boolean }
  }
  
  // Behavior with empty preconditions
  behavior EmptyPreconditions {
    input {
      value: String
    }
    
    output {
      success: Boolean
    }
    
    preconditions { }
    postconditions { }
  }
  
  // Empty scenarios block
  scenarios MinimalBehavior {
  }
  
  // Empty views block - rewritten with supported syntax
  view EmptyView {
    for: MinimalEntity
    fields {
      id: UUID = entity.id
    }
  }
  
  // Empty policy - rewritten with supported syntax
  policy EmptyPolicy {
    applies_to: all behaviors
    rules {
      default: allow
    }
  }
  
  // Struct with single field
  type SingleFieldStruct = {
    only_field: String
  }
  
  // Empty global invariants removed - nameless invariants { } not supported
}
