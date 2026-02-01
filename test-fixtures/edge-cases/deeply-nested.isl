// Edge case: Deeply nested structures

domain DeeplyNested {
  version: "1.0.0"
  
  // Deeply nested struct type
  type Level5 = {
    value: String
  }
  
  type Level4 = {
    nested: Level5
    values: List<Level5>
  }
  
  type Level3 = {
    nested: Level4
    map: Map<String, Level4>
  }
  
  type Level2 = {
    nested: Level3
    list: List<Level3>
  }
  
  type Level1 = {
    nested: Level2
    optional: Level2?
  }
  
  type DeepRoot = {
    nested: Level1
    metadata: Map<String, Level1>
  }
  
  // Inline deeply nested struct
  type InlineDeep = {
    l1: {
      l2: {
        l3: {
          l4: {
            l5: {
              value: String
            }
          }
        }
      }
    }
  }
  
  // Deeply nested list types
  type NestedList1 = List<String>
  type NestedList2 = List<List<String>>
  type NestedList3 = List<List<List<String>>>
  type NestedList4 = List<List<List<List<String>>>>
  type NestedList5 = List<List<List<List<List<String>>>>>
  
  // Deeply nested map types
  type NestedMap1 = Map<String, String>
  type NestedMap2 = Map<String, Map<String, String>>
  type NestedMap3 = Map<String, Map<String, Map<String, String>>>
  
  // Mixed deep nesting
  type ComplexNesting = Map<String, List<Map<String, List<{
    id: UUID
    data: Map<String, List<String>>
    children: List<{
      name: String
      values: Map<String, Int>
    }>
  }>>>>
  
  // Entity with deeply nested fields
  entity ComplexEntity {
    id: UUID [immutable, unique]
    
    config: {
      settings: {
        advanced: {
          features: {
            enabled: List<{
              name: String
              params: Map<String, {
                type: String
                value: String
                metadata: Map<String, String>
              }>
            }>
          }
        }
      }
    }
    
    tree: {
      root: {
        children: List<{
          name: String
          children: List<{
            name: String
            leaf: Boolean
          }>
        }>
      }
    }
  }
  
  // Behavior with deeply nested I/O
  behavior ProcessDeep {
    input {
      data: {
        level1: {
          level2: {
            level3: {
              values: List<String>
              config: Map<String, Int>
            }
          }
        }
      }
    }
    
    output {
      success: {
        result: {
          processed: {
            items: List<{
              id: UUID
              status: String
              metadata: Map<String, String>
            }>
          }
        }
      }
    }
    
    postconditions {
      success implies {
        result.result.processed.items.length >= 0
      }
    }
  }
  
  // Deeply nested expressions in invariants
  entity DataStore {
    id: UUID
    data: DeepRoot
    
    invariants {
      data.nested.nested.nested.nested.nested.value.length > 0
      all(k in data.metadata: data.metadata[k].nested.nested.nested.nested.nested.value != null)
    }
  }
}
