// Webhooks: Event type management
domain WebhooksEventTypes {
  version: "1.0.0"

  enum EventCategory {
    PAYMENT
    CUSTOMER
    SUBSCRIPTION
    INVOICE
    ORDER
    USER
    SYSTEM
  }

  entity EventType {
    id: UUID [immutable, unique]
    name: String [unique]
    category: EventCategory
    description: String
    schema: String
    version: String
    deprecated: Boolean [default: false]
    deprecated_at: Timestamp?
    replacement: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      name matches "^[a-z]+\\.[a-z_]+$"
      deprecated implies deprecated_at != null
    }
  }

  entity EventTypeSubscription {
    id: UUID [immutable, unique]
    endpoint_id: UUID [indexed]
    event_type: String [indexed]
    enabled: Boolean [default: true]
    created_at: Timestamp [immutable]
  }

  behavior ListEventTypes {
    description: "List available event types"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      category: EventCategory?
      include_deprecated: Boolean?
    }

    output {
      success: List<EventType>
    }

    post success {
      - input.include_deprecated != true implies all(e in result: e.deprecated == false)
      - input.category != null implies all(e in result: e.category == input.category)
    }
  }

  behavior GetEventType {
    description: "Get event type details"

    actors {
      User { must: authenticated }
    }

    input {
      name: String
    }

    output {
      success: EventType

      errors {
        NOT_FOUND {
          when: "Event type not found"
          retriable: false
        }
      }
    }

    pre {
      EventType.exists(name: input.name)
    }
  }

  behavior CreateEventType {
    description: "Create a new event type"

    actors {
      Admin { must: authenticated }
    }

    input {
      name: String
      category: EventCategory
      description: String
      schema: String
      version: String?
    }

    output {
      success: EventType

      errors {
        NAME_EXISTS {
          when: "Event type already exists"
          retriable: false
        }
        INVALID_NAME {
          when: "Event name format invalid"
          retriable: true
        }
        INVALID_SCHEMA {
          when: "Schema is invalid JSON"
          retriable: true
        }
      }
    }

    pre {
      input.name matches "^[a-z]+\\.[a-z_]+$"
      not EventType.exists(name: input.name)
    }

    post success {
      - EventType.exists(result.id)
      - result.deprecated == false
    }
  }

  behavior DeprecateEventType {
    description: "Mark event type as deprecated"

    actors {
      Admin { must: authenticated }
    }

    input {
      name: String
      replacement: String?
    }

    output {
      success: EventType

      errors {
        NOT_FOUND {
          when: "Event type not found"
          retriable: false
        }
        ALREADY_DEPRECATED {
          when: "Already deprecated"
          retriable: false
        }
        INVALID_REPLACEMENT {
          when: "Replacement event not found"
          retriable: false
        }
      }
    }

    pre {
      EventType.exists(name: input.name)
      input.replacement == null or EventType.exists(name: input.replacement)
    }

    post success {
      - result.deprecated == true
      - result.deprecated_at != null
    }
  }

  behavior SubscribeToEvent {
    description: "Subscribe endpoint to event type"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      event_type: String
    }

    output {
      success: EventTypeSubscription

      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint not found"
          retriable: false
        }
        EVENT_TYPE_NOT_FOUND {
          when: "Event type not found"
          retriable: false
        }
        ALREADY_SUBSCRIBED {
          when: "Already subscribed"
          retriable: false
        }
        EVENT_DEPRECATED {
          when: "Event type is deprecated"
          retriable: false
        }
      }
    }

    pre {
      EventType.exists(name: input.event_type)
      EventType.lookup(input.event_type).deprecated == false
    }

    post success {
      - EventTypeSubscription.exists(result.id)
      - result.enabled == true
    }
  }

  behavior UnsubscribeFromEvent {
    description: "Unsubscribe endpoint from event type"

    actors {
      User { must: authenticated }
    }

    input {
      endpoint_id: UUID
      event_type: String
    }

    output {
      success: Boolean

      errors {
        SUBSCRIPTION_NOT_FOUND {
          when: "Subscription not found"
          retriable: false
        }
      }
    }

    post success {
      - not EventTypeSubscription.exists(endpoint_id: input.endpoint_id, event_type: input.event_type)
    }
  }

  scenarios ListEventTypes {
    scenario "list payment events" {
      when {
        result = ListEventTypes(category: PAYMENT)
      }

      then {
        result is success
        all(e in result: e.category == PAYMENT)
      }
    }
  }
}
