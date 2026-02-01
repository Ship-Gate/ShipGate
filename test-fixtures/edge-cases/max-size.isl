// Edge case: Stress test with maximum size
// This file tests parser performance with many declarations

domain StressTest {
  version: "1.0.0"
  owner: "Performance Testing"
  
  // Many type definitions
  type Type001 = String { max_length: 100 }
  type Type002 = String { max_length: 100 }
  type Type003 = String { max_length: 100 }
  type Type004 = String { max_length: 100 }
  type Type005 = String { max_length: 100 }
  type Type006 = String { max_length: 100 }
  type Type007 = String { max_length: 100 }
  type Type008 = String { max_length: 100 }
  type Type009 = String { max_length: 100 }
  type Type010 = String { max_length: 100 }
  type Type011 = Int { min: 0, max: 1000 }
  type Type012 = Int { min: 0, max: 1000 }
  type Type013 = Int { min: 0, max: 1000 }
  type Type014 = Int { min: 0, max: 1000 }
  type Type015 = Int { min: 0, max: 1000 }
  type Type016 = Decimal { precision: 2 }
  type Type017 = Decimal { precision: 2 }
  type Type018 = Decimal { precision: 2 }
  type Type019 = Decimal { precision: 2 }
  type Type020 = Decimal { precision: 2 }
  
  // Many enum definitions
  enum Enum001 { V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 }
  enum Enum002 { V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 }
  enum Enum003 { V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 }
  enum Enum004 { V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 }
  enum Enum005 { V1, V2, V3, V4, V5, V6, V7, V8, V9, V10 }
  
  // Entity with many fields
  entity LargeEntity {
    id: UUID [immutable, unique]
    field001: String
    field002: String
    field003: String
    field004: String
    field005: String
    field006: String
    field007: String
    field008: String
    field009: String
    field010: String
    field011: Int
    field012: Int
    field013: Int
    field014: Int
    field015: Int
    field016: Decimal
    field017: Decimal
    field018: Decimal
    field019: Decimal
    field020: Decimal
    field021: Boolean
    field022: Boolean
    field023: Boolean
    field024: Boolean
    field025: Boolean
    field026: Timestamp
    field027: Timestamp
    field028: Timestamp
    field029: Timestamp
    field030: Timestamp
    field031: UUID
    field032: UUID
    field033: UUID
    field034: UUID
    field035: UUID
    field036: List<String>
    field037: List<Int>
    field038: Map<String, String>
    field039: Map<String, Int>
    field040: Duration
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      field001.length > 0
      field002.length > 0
      field003.length > 0
      field011 >= 0
      field012 >= 0
      field013 >= 0
      field016 >= 0
      field017 >= 0
      field018 >= 0
    }
  }
  
  // Many entities
  entity Entity001 { id: UUID [immutable, unique]; name: String }
  entity Entity002 { id: UUID [immutable, unique]; name: String }
  entity Entity003 { id: UUID [immutable, unique]; name: String }
  entity Entity004 { id: UUID [immutable, unique]; name: String }
  entity Entity005 { id: UUID [immutable, unique]; name: String }
  entity Entity006 { id: UUID [immutable, unique]; name: String }
  entity Entity007 { id: UUID [immutable, unique]; name: String }
  entity Entity008 { id: UUID [immutable, unique]; name: String }
  entity Entity009 { id: UUID [immutable, unique]; name: String }
  entity Entity010 { id: UUID [immutable, unique]; name: String }
  
  // Behavior with many preconditions and postconditions
  behavior ComplexBehavior {
    description: "A behavior with many conditions"
    
    input {
      param001: String
      param002: String
      param003: String
      param004: String
      param005: String
      param006: Int
      param007: Int
      param008: Int
      param009: Int
      param010: Int
    }
    
    output {
      success: LargeEntity
      
      errors {
        ERROR_001 { when: "Error condition 1" }
        ERROR_002 { when: "Error condition 2" }
        ERROR_003 { when: "Error condition 3" }
        ERROR_004 { when: "Error condition 4" }
        ERROR_005 { when: "Error condition 5" }
        ERROR_006 { when: "Error condition 6" }
        ERROR_007 { when: "Error condition 7" }
        ERROR_008 { when: "Error condition 8" }
        ERROR_009 { when: "Error condition 9" }
        ERROR_010 { when: "Error condition 10" }
      }
    }
    
    preconditions {
      input.param001.length > 0
      input.param002.length > 0
      input.param003.length > 0
      input.param004.length > 0
      input.param005.length > 0
      input.param006 >= 0
      input.param007 >= 0
      input.param008 >= 0
      input.param009 >= 0
      input.param010 >= 0
      input.param006 <= 1000
      input.param007 <= 1000
      input.param008 <= 1000
      input.param009 <= 1000
      input.param010 <= 1000
    }
    
    postconditions {
      success implies {
        LargeEntity.exists(result.id)
        result.field001 == input.param001
        result.field002 == input.param002
        result.field003 == input.param003
        result.field004 == input.param004
        result.field005 == input.param005
        result.field011 == input.param006
        result.field012 == input.param007
        result.field013 == input.param008
        result.field014 == input.param009
        result.field015 == input.param010
      }
    }
  }
  
  // Many behaviors
  behavior Behavior001 { input { v: String } output { success: Boolean } }
  behavior Behavior002 { input { v: String } output { success: Boolean } }
  behavior Behavior003 { input { v: String } output { success: Boolean } }
  behavior Behavior004 { input { v: String } output { success: Boolean } }
  behavior Behavior005 { input { v: String } output { success: Boolean } }
  behavior Behavior006 { input { v: String } output { success: Boolean } }
  behavior Behavior007 { input { v: String } output { success: Boolean } }
  behavior Behavior008 { input { v: String } output { success: Boolean } }
  behavior Behavior009 { input { v: String } output { success: Boolean } }
  behavior Behavior010 { input { v: String } output { success: Boolean } }
  behavior Behavior011 { input { v: String } output { success: Boolean } }
  behavior Behavior012 { input { v: String } output { success: Boolean } }
  behavior Behavior013 { input { v: String } output { success: Boolean } }
  behavior Behavior014 { input { v: String } output { success: Boolean } }
  behavior Behavior015 { input { v: String } output { success: Boolean } }
  behavior Behavior016 { input { v: String } output { success: Boolean } }
  behavior Behavior017 { input { v: String } output { success: Boolean } }
  behavior Behavior018 { input { v: String } output { success: Boolean } }
  behavior Behavior019 { input { v: String } output { success: Boolean } }
  behavior Behavior020 { input { v: String } output { success: Boolean } }
  
  // Many scenarios
  scenarios ComplexBehavior {
    scenario "scenario 001" {
      when { result = ComplexBehavior(param001: "a", param002: "b", param003: "c", param004: "d", param005: "e", param006: 1, param007: 2, param008: 3, param009: 4, param010: 5) }
      then { result is success }
    }
    scenario "scenario 002" {
      when { result = ComplexBehavior(param001: "a", param002: "b", param003: "c", param004: "d", param005: "e", param006: 1, param007: 2, param008: 3, param009: 4, param010: 5) }
      then { result is success }
    }
    scenario "scenario 003" {
      when { result = ComplexBehavior(param001: "a", param002: "b", param003: "c", param004: "d", param005: "e", param006: 1, param007: 2, param008: 3, param009: 4, param010: 5) }
      then { result is success }
    }
    scenario "scenario 004" {
      when { result = ComplexBehavior(param001: "a", param002: "b", param003: "c", param004: "d", param005: "e", param006: 1, param007: 2, param008: 3, param009: 4, param010: 5) }
      then { result is success }
    }
    scenario "scenario 005" {
      when { result = ComplexBehavior(param001: "a", param002: "b", param003: "c", param004: "d", param005: "e", param006: 1, param007: 2, param008: 3, param009: 4, param010: 5) }
      then { result is success }
    }
  }
  
  // Many global invariants
  invariants {
    all(e in Entity001: e.name.length > 0)
    all(e in Entity002: e.name.length > 0)
    all(e in Entity003: e.name.length > 0)
    all(e in Entity004: e.name.length > 0)
    all(e in Entity005: e.name.length > 0)
    all(e in Entity006: e.name.length > 0)
    all(e in Entity007: e.name.length > 0)
    all(e in Entity008: e.name.length > 0)
    all(e in Entity009: e.name.length > 0)
    all(e in Entity010: e.name.length > 0)
  }
}
