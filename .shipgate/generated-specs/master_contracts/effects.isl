domain Effects {
  version: "1.0.0"

  entity Effect {
    id: String
  }
  entity Pure {
    id: String
  }
  entity IO {
    id: String
  }
  entity Database {
    id: String
  }
  entity Network {
    id: String
  }
  entity Time {
    id: String
  }
  entity Random {
    id: String
  }
  entity Logging {
    id: String
  }
  entity Metrics {
    id: String
  }
  entity Auth {
    id: String
  }
  entity Cache {
    id: String
  }
  entity QueueEffect {
    id: String
  }
  entity Email {
    id: String
  }
  entity Storage {
    id: String
  }
  entity Async {
    id: String
  }
  entity Fallible {
    id: String
  }
  entity EffectUnion {
    id: String
  }
  entity EffectRow {
    id: String
  }
  entity HasEffect {
    id: String
  }
  entity AddEffect {
    id: String
  }
  entity RemoveEffect {
    id: String
  }
  entity Eff {
    id: String
  }
  entity EffectHandler {
    id: String
  }
  entity EffectHandlerRegistry {
    id: String
  }
  entity BehaviorEffects {
    id: String
  }
  entity Linear {
    id: String
  }
  entity Affine {
    id: String
  }
  entity Capability {
    id: String
  }
  entity EffectPolymorphic {
    id: String
  }

  behavior pure {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - pure never_throws_unhandled
    }
  }
  behavior perform {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - perform never_throws_unhandled
    }
  }
  behavior map {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - map never_throws_unhandled
    }
  }
  behavior flatMap {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - flatMap never_throws_unhandled
    }
  }
  behavior runWithHandlers {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - runWithHandlers never_throws_unhandled
    }
  }
  behavior inferEffects {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - inferEffects never_throws_unhandled
    }
  }
  behavior verifyEffects {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - verifyEffects never_throws_unhandled
    }
  }
  behavior linear {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - linear never_throws_unhandled
    }
  }
  behavior consume {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - consume never_throws_unhandled
    }
  }
  behavior withCapability {
    input {
      request: String
    }

    output {
      success: Boolean
    }

    invariants {
      - withCapability never_throws_unhandled
    }
  }
}
