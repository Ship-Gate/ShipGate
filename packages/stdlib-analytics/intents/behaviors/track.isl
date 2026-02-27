# Track Behavior
# Track analytics events

import { Analytics } from "../domain.isl"

behavior Track {
  description: "Track an analytics event with properties"
  
  actors {
    Application {
      for: event_tracking
    }
    Server {
      for: server_side_tracking
    }
  }
  
  input {
    event: EventName
    user_id: UserId?
    anonymous_id: AnonymousId?
    properties: Map<String, Any>?
    context: Context?
    timestamp: Timestamp?
    integrations: Map<String, Boolean>?  # Enable/disable specific integrations
  }
  
  output {
    success: {
      id: TrackingId
      queued: Boolean
    }
    
    errors {
      INVALID_EVENT_NAME {
        when: "Event name does not match pattern"
        retriable: false
      }
      MISSING_IDENTIFIER {
        when: "Neither user_id nor anonymous_id provided"
        retriable: false
      }
      QUEUE_FULL {
        when: "Event queue is at capacity"
        retriable: true
        retry_after: 1s
      }
      RATE_LIMITED {
        when: "Too many events sent"
        retriable: true
        retry_after: 5s
      }
    }
  }
  
  preconditions {
    # Must have at least one identifier
    input.user_id != null or input.anonymous_id != null
    
    # Event name must be valid
    input.event.matches("^[A-Za-z][A-Za-z0-9_]*$")
    input.event.length <= 128
  }
  
  postconditions {
    success implies {
      - TrackEvent.exists(result.id)
      - TrackEvent.lookup(result.id).event == input.event
      - result.queued == true or event_sent_to_provider
    }
    
    QUEUE_FULL implies {
      - event_dropped or queued_for_retry
    }
  }
  
  invariants {
    - async_delivery: "Does not block calling code"
    - at_least_once_delivery: "Event delivered at least once"
    - properties serializable to JSON
    - timestamp defaults to now() if not provided
  }
  
  temporal {
    - within 5ms (p99): returns to caller
    - eventually within 30s: event sent to provider
  }
  
  security {
    - rate_limit 1000 per minute per user_id
    - rate_limit 10000 per minute per application
  }
}

# ============================================
# Track Scenarios
# ============================================

scenarios Track {
  scenario "track simple event" {
    when {
      result = Track(
        event: "Button_Clicked",
        user_id: "user_123",
        properties: {
          "button_id": "signup_cta",
          "page": "/landing"
        }
      )
    }
    
    then {
      result is success
      result.queued == true
    }
  }
  
  scenario "track e-commerce purchase" {
    when {
      result = Track(
        event: "Order_Completed",
        user_id: "user_123",
        properties: {
          "order_id": "order_456",
          "revenue": 99.99,
          "currency": "USD",
          "coupon": "SAVE10",
          "products": [
            { 
              "product_id": "prod_1", 
              "name": "Widget", 
              "price": 49.99,
              "quantity": 1
            },
            { 
              "product_id": "prod_2", 
              "name": "Gadget", 
              "price": 50.00,
              "quantity": 1
            }
          ]
        }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "track with anonymous user" {
    when {
      result = Track(
        event: "Page_Viewed",
        anonymous_id: "anon_abc123",
        properties: { "page_name": "Homepage" }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "reject invalid event name" {
    when {
      result = Track(
        event: "123_Invalid",  # Starts with number
        user_id: "user_123"
      )
    }
    
    then {
      result is error INVALID_EVENT_NAME
    }
  }
  
  scenario "reject missing identifier" {
    when {
      result = Track(
        event: "Some_Event"
        # No user_id or anonymous_id
      )
    }
    
    then {
      result is error MISSING_IDENTIFIER
    }
  }
}
