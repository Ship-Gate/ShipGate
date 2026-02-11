domain RefinementTypes {
  version: "1.0.0"

  entity Refinement {
    id: String
  }
  entity Predicate {
    id: String
  }
  entity PositiveInt {
    id: String
  }
  entity NonNegativeInt {
    id: String
  }
  entity NegativeInt {
    id: String
  }
  entity Percentage {
    id: String
  }
  entity NonEmptyString {
    id: String
  }
  entity Email {
    id: String
  }
  entity UUID {
    id: String
  }
  entity URL {
    id: String
  }
  entity ISODate {
    id: String
  }
  entity RefinementTypeAST {
    id: String
  }
  entity TypeAST {
    id: String
  }
  entity PredicateAST {
    id: String
  }
  entity ComparisonPredicate {
    id: String
  }
  entity PatternPredicate {
    id: String
  }
  entity PropertyPredicate {
    id: String
  }
  entity LogicalPredicate {
    id: String
  }
  entity ExpressionAST {
    id: String
  }
  entity SMTQuery {
    id: String
  }
  entity SMTResult {
    id: String
  }
  entity LiquidTypeInference {
    id: String
  }

  behavior refine {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - refine never_throws_unhandled
    }
  }
  behavior unsafeRefine {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - unsafeRefine never_throws_unhandled
    }
  }
  behavior inRange {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - inRange never_throws_unhandled
    }
  }
  behavior greaterThan {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - greaterThan never_throws_unhandled
    }
  }
  behavior lessThan {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - lessThan never_throws_unhandled
    }
  }
  behavior divisibleBy {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - divisibleBy never_throws_unhandled
    }
  }
  behavior minLength {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - minLength never_throws_unhandled
    }
  }
  behavior maxLength {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - maxLength never_throws_unhandled
    }
  }
  behavior lengthBetween {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - lengthBetween never_throws_unhandled
    }
  }
  behavior matches {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - matches never_throws_unhandled
    }
  }
  behavior startsWith {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - startsWith never_throws_unhandled
    }
  }
  behavior endsWith {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - endsWith never_throws_unhandled
    }
  }
  behavior nonEmptyArray {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - nonEmptyArray never_throws_unhandled
    }
  }
  behavior arrayMinLength {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - arrayMinLength never_throws_unhandled
    }
  }
  behavior arrayMaxLength {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - arrayMaxLength never_throws_unhandled
    }
  }
  behavior allSatisfy {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - allSatisfy never_throws_unhandled
    }
  }
  behavior someSatisfy {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - someSatisfy never_throws_unhandled
    }
  }
  behavior and {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - and never_throws_unhandled
    }
  }
  behavior or {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - or never_throws_unhandled
    }
  }
  behavior not {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - not never_throws_unhandled
    }
  }
  behavior implies {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - implies never_throws_unhandled
    }
  }
  behavior checkRefinement {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - checkRefinement never_throws_unhandled
    }
  }
  behavior generateSMTQuery {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - generateSMTQuery never_throws_unhandled
    }
  }
}
