domain SessionTypes {
  version: "1.0.0"

  entity Send {
    id: String
  }
  entity Receive {
    id: String
  }
  entity End {
    id: String
  }
  entity Select {
    id: String
  }
  entity Offer {
    id: String
  }
  entity Rec {
    id: String
  }
  entity Var {
    id: String
  }
  entity Session {
    id: String
  }
  entity Dual {
    id: String
  }
  entity RequestResponseClient {
    id: String
  }
  entity RequestResponseServer {
    id: String
  }
  entity AuthClient {
    id: String
  }
  entity AuthServer {
    id: String
  }
  entity Channel {
    id: String
  }
  entity SessionTypeAST {
    id: String
  }
  entity SessionBodyAST {
    id: String
  }
  entity MessageAST {
    id: String
  }
  entity ChoiceAST {
    id: String
  }
  entity RecursionAST {
    id: String
  }
  entity ContinueAST {
    id: String
  }
  entity EndAST {
    id: String
  }
  entity MultipartySession {
    id: String
  }
  entity BehaviorWithSession {
    id: String
  }

  behavior createChannelPair {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - createChannelPair never_throws_unhandled
    }
  }
  behavior validateSessionType {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - validateSessionType never_throws_unhandled
    }
  }
  behavior areDual {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - areDual never_throws_unhandled
    }
  }
  behavior projectSession {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - projectSession never_throws_unhandled
    }
  }
}
