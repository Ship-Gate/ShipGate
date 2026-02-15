# AI-proposed spec with low-evidence rules
# No invariants, no postconditions — just structural entities and behaviors
# This represents an AI-generated spec where rules are speculative (not test-validated)

domain AnalyticsService {
  version: "1.0.0"

  entity Event {
    id: UUID [immutable, unique]
    name: String
    payload: String
    timestamp: Timestamp [immutable]
  }

  behavior TrackEvent {
    input {
      name: String
      payload: String
    }

    output {
      success: Event
      errors {
        INVALID_EVENT {
          when: "Event name is empty"
          retriable: false
        }
      }
    }
  }
}
