domain MaxComplexity {
  version: "1.0.0"
  owner: "Test"

  type T1 = String { min_length: 1 max_length: 255 }
  type T2 = Int { min: 0 max: 999 }
  type T3 = Decimal { min: 0 max: 100 }
  enum E1 { A B C }
  enum E2 { X Y Z }

  entity E {
    id: UUID [immutable, unique]
    f1: T1
    f2: T2?
    f3: T3
    f4: E1
    f5: E2?
    f6: { a: Int b: String }
  }

  invariants global_inv {
    - E.count >= 0
  }

  behavior B1 {
    description: "Complex behavior"
    actors { User { } }
    input { x: T1 y: T2? z: E1 }
    output {
      success: E
      errors {
        E1 { when: "Error 1" retriable: true }
        E2 { when: "Error 2" retriable: false }
      }
    }
    preconditions { - input.x.length > 0 }
    postconditions {
      success implies { - E.exists(result.id) }
      any_error implies { - true }
    }
    invariants { - input.x != "bad" }
    temporal { response within 100ms }
    security { requires authenticated }
  }

  policy P1 {
    applies_to: all
    rules {
      when (true): allow
      default: deny
    }
  }

  scenarios B1 {
    scenario "s1" {
      given { x = 1 }
      when { r = B1(x: "a", y: 2, z: A) }
      then { r != null }
    }
  }

  chaos B1 {
    scenario "c1" {
      inject { database_failure() }
      when { r = B1(x: "a", y: 2, z: A) }
      then { r is error }
    }
  }
}
