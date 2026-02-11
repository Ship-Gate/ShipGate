domain DependentTypes {
  version: "1.0.0"

  entity PiType {
    id: String
  }
  entity SigmaType {
    id: String
  }
  entity Vector {
    id: String
  }
  entity Zero {
    id: String
  }
  entity Succ {
    id: String
  }
  entity Empty {
    id: String
  }
  entity NonEmpty {
    id: String
  }
  entity Fin {
    id: String
  }
  entity Equal {
    id: String
  }
  entity Sized {
    id: String
  }
  entity TypeFamily {
    id: String
  }
  entity Expr {
    id: String
  }
  entity IntLit {
    id: String
  }
  entity BoolLit {
    id: String
  }
  entity Add {
    id: String
  }
  entity IfExpr {
    id: String
  }
  entity EqExpr {
    id: String
  }
  entity If {
    id: String
  }
  entity Length {
    id: String
  }
  entity Head {
    id: String
  }
  entity Tail {
    id: String
  }
  entity Concat {
    id: String
  }

  behavior head {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - head never_throws_unhandled
    }
  }
  behavior tail {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - tail never_throws_unhandled
    }
  }
  behavior fin {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - fin never_throws_unhandled
    }
  }
  behavior safeIndex {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - safeIndex never_throws_unhandled
    }
  }
  behavior refl {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - refl never_throws_unhandled
    }
  }
  behavior subst {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - subst never_throws_unhandled
    }
  }
  behavior evaluate {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - evaluate never_throws_unhandled
    }
  }
}
