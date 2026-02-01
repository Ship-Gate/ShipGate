# Webhooks Domain
# Complete webhook management with delivery, retry, and verification

domain Webhooks {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type WebhookUrl = String { format: "uri", max_length: 2048 }
  type WebhookSecret = String { min_length: 32, max_length: 64 }
  type EventType = String { max_length: 100 }
  
  enum DeliveryStatus {
    PENDING
    DELIVERING
    DELIVERED
    FAILED
    RETRYING
  }
  
  enum HttpMethod {
    POST
    PUT
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity WebhookEndpoint {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    url: WebhookUrl
    secret: WebhookSecret [secret]
    description: String?
    events: List<EventType>
    is_active: Boolean [default: true]
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      events.length > 0
      url.starts_with("https://")
    }
  }
  
  entity WebhookEvent {
    id: UUID [immutable, unique]
    event_type: EventType [indexed]
    payload: String
    source_id: UUID?
    source_type: String?
    created_at: Timestamp [immutable, indexed]
    
    invariants {
      payload.length > 0
    }
  }
  
  entity WebhookDelivery {
    id: UUID [immutable, unique]
    endpoint_id: UUID [indexed]
    event_id: UUID [indexed]
    status: DeliveryStatus
    request_headers: Map<String, String>
    request_body: String
    response_status: Int?
    response_headers: Map<String, String>?
    response_body: String?
    attempts: Int [default: 0]
    max_attempts: Int [default: 5]
    next_retry_at: Timestamp?
    delivered_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      attempts >= 0
      attempts <= max_attempts
      status == DELIVERED implies delivered_at != null
      status == RETRYING implies next_retry_at != null
    }
    
    lifecycle {
      PENDING -> DELIVERING
      DELIVERING -> DELIVERED
      DELIVERING -> RETRYING
      DELIVERING -> FAILED
      RETRYING -> DELIVERING
      RETRYING -> FAILED
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateEndpoint {
    description: "Register a new webhook endpoint"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      url: WebhookUrl
      events: List<EventType>
      description: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: {
        endpoint: WebhookEndpoint
        secret: WebhookSecret
      }
      
      errors {
        INVALID_URL {
          when: "URL is not a valid HTTPS endpoint"
          retriable: false
        }
        URL_ALREADY_REGISTERED {
          when: "This URL is already registered for this owner"
          retriable: false
        }
        INVALID_EVENTS {
          when: "One or more event types are invalid"
          retriable: false
        }
        MAX_ENDPOINTS_REACHED {
          when: "Maximum number of endpoints reached"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.url.starts_with("https://")
      not WebhookEndpoint.exists(owner_id: actor.id, url: input.url)
    }
    
    postconditions {
      success implies {
        WebhookEndpoint.exists(result.endpoint.id)
        result.endpoint.secret != null
      }
    }
    
    invariants {
      result.secret generated with cryptographic randomness
    }
  }
  
  behavior UpdateEndpoint {
    description: "Update webhook endpoint configuration"
    
    actors {
      User { must: authenticated, owns: endpoint }
    }
    
    input {
      endpoint_id: UUID
      url: WebhookUrl?
      events: List<EventType>?
      description: String?
      is_active: Boolean?
    }
    
    output {
      success: WebhookEndpoint
      
      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint does not exist"
          retriable: false
        }
        INVALID_URL {
          when: "URL is not a valid HTTPS endpoint"
          retriable: false
        }
      }
    }
  }
  
  behavior DeleteEndpoint {
    description: "Delete a webhook endpoint"
    
    actors {
      User { must: authenticated, owns: endpoint }
    }
    
    input {
      endpoint_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint does not exist"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        not WebhookEndpoint.exists(input.endpoint_id)
      }
    }
  }
  
  behavior RotateSecret {
    description: "Generate a new secret for an endpoint"
    
    actors {
      User { must: authenticated, owns: endpoint }
    }
    
    input {
      endpoint_id: UUID
    }
    
    output {
      success: {
        endpoint: WebhookEndpoint
        new_secret: WebhookSecret
      }
      
      errors {
        ENDPOINT_NOT_FOUND {
          when: "Endpoint does not exist"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        WebhookEndpoint.lookup(input.endpoint_id).secret != old(WebhookEndpoint.lookup(input.endpoint_id).secret)
      }
    }
    
    security {
      audit_log enabled
    }
  }
  
  behavior DispatchEvent {
    description: "Dispatch an event to all matching endpoints"
    
    actors {
      System { }
    }
    
    input {
      event_type: EventType
      payload: Map<String, Any>
      source_id: UUID?
      source_type: String?
    }
    
    output {
      success: {
        event: WebhookEvent
        deliveries_created: Int
      }
    }
    
    postconditions {
      success implies {
        WebhookEvent.exists(result.event.id)
        WebhookDelivery.count(event_id: result.event.id) == result.deliveries_created
      }
    }
    
    temporal {
      response within 100ms
      eventually within 30s: first delivery attempt
    }
  }
  
  behavior DeliverWebhook {
    description: "Attempt to deliver a webhook to an endpoint"
    
    actors {
      System { }
    }
    
    input {
      delivery_id: UUID
    }
    
    output {
      success: WebhookDelivery
      
      errors {
        DELIVERY_NOT_FOUND {
          when: "Delivery does not exist"
          retriable: false
        }
        ENDPOINT_DISABLED {
          when: "Endpoint is disabled"
          retriable: false
        }
        DELIVERY_TIMEOUT {
          when: "Request timed out"
          retriable: true
          retry_after: exponential_backoff
        }
        DELIVERY_FAILED {
          when: "Endpoint returned non-2xx status"
          retriable: true
          retry_after: exponential_backoff
        }
      }
    }
    
    postconditions {
      success implies {
        WebhookDelivery.lookup(input.delivery_id).status == DELIVERED
        WebhookDelivery.lookup(input.delivery_id).response_status >= 200
        WebhookDelivery.lookup(input.delivery_id).response_status < 300
      }
      
      DELIVERY_FAILED implies {
        WebhookDelivery.lookup(input.delivery_id).attempts == old(WebhookDelivery.lookup(input.delivery_id).attempts) + 1
      }
    }
    
    invariants {
      request includes X-Webhook-Signature header
      request includes X-Webhook-Timestamp header
      request includes X-Webhook-ID header
    }
    
    temporal {
      timeout 30s per request
      retry with exponential_backoff(base: 1m, max: 24h)
    }
  }
  
  behavior RetryDelivery {
    description: "Manually retry a failed delivery"
    
    actors {
      User { must: authenticated, owns: endpoint }
      Admin { must: authenticated }
    }
    
    input {
      delivery_id: UUID
    }
    
    output {
      success: WebhookDelivery
      
      errors {
        DELIVERY_NOT_FOUND {
          when: "Delivery does not exist"
          retriable: false
        }
        ALREADY_DELIVERED {
          when: "Delivery was already successful"
          retriable: false
        }
        MAX_RETRIES_EXCEEDED {
          when: "Maximum retry attempts exceeded"
          retriable: false
        }
      }
    }
  }
  
  behavior ListDeliveries {
    description: "List webhook deliveries with filtering"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      endpoint_id: UUID?
      event_type: EventType?
      status: DeliveryStatus?
      from_date: Timestamp?
      to_date: Timestamp?
      limit: Int [default: 50, max: 100]
      cursor: String?
    }
    
    output {
      success: {
        deliveries: List<WebhookDelivery>
        next_cursor: String?
        total_count: Int
      }
    }
  }
  
  behavior VerifySignature {
    description: "Verify webhook signature for incoming requests"
    
    actors {
      System { }
    }
    
    input {
      payload: String
      signature: String
      timestamp: String
      secret: WebhookSecret
    }
    
    output {
      success: {
        valid: Boolean
        error: String?
      }
    }
    
    invariants {
      signature computed using HMAC-SHA256
      timestamp tolerance 5 minutes
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios DeliverWebhook {
    scenario "successful delivery" {
      given {
        endpoint = WebhookEndpoint.create(
          url: "https://example.com/webhook",
          events: ["order.created"]
        )
        event = WebhookEvent.create(
          event_type: "order.created",
          payload: "{\"order_id\": \"123\"}"
        )
        delivery = WebhookDelivery.create(
          endpoint_id: endpoint.id,
          event_id: event.id,
          status: PENDING
        )
      }
      
      when {
        result = DeliverWebhook(delivery_id: delivery.id)
      }
      
      then {
        result is success
        result.status == DELIVERED
        result.response_status == 200
      }
    }
    
    scenario "retry on failure" {
      given {
        delivery = WebhookDelivery.create(
          status: PENDING,
          attempts: 0
        )
      }
      
      when {
        // Endpoint returns 500
        result = DeliverWebhook(delivery_id: delivery.id)
      }
      
      then {
        result is DELIVERY_FAILED
        WebhookDelivery.lookup(delivery.id).status == RETRYING
        WebhookDelivery.lookup(delivery.id).attempts == 1
        WebhookDelivery.lookup(delivery.id).next_retry_at != null
      }
    }
  }
}
