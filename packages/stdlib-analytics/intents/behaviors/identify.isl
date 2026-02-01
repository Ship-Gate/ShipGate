# Identify Behavior
# Identify users with traits

import { Analytics } from "../domain.isl"

behavior Identify {
  description: "Identify a user with traits and link anonymous activity"
  
  actors {
    Application {
      for: user_identification
    }
  }
  
  input {
    user_id: UserId
    anonymous_id: AnonymousId?  # For linking anonymous to identified
    traits: Map<String, Any>?
    context: Context?
    timestamp: Timestamp?
  }
  
  output {
    success: {
      id: TrackingId
      merged: Boolean  # True if anonymous events were merged
    }
    
    errors {
      INVALID_USER_ID {
        when: "User ID is empty or invalid"
        retriable: false
      }
      MERGE_FAILED {
        when: "Failed to merge anonymous events"
        retriable: true
      }
    }
  }
  
  preconditions {
    input.user_id != null
    input.user_id.length > 0
    input.user_id.length <= 256
  }
  
  postconditions {
    success implies {
      - IdentifyEvent.exists(result.id)
      - user_profile_updated(input.user_id, input.traits)
      
      # If anonymous_id provided, events should be merged
      input.anonymous_id != null implies {
        - result.merged == true
        - events_from(input.anonymous_id) now attributed to input.user_id
      }
    }
  }
  
  invariants {
    - traits may contain PII (marked appropriately)
    - user can request deletion of traits (GDPR)
    - identify is idempotent for same user_id
  }
  
  temporal {
    - within 5ms (p99): returns to caller
    - eventually within 60s: profile updated in provider
  }
  
  compliance {
    gdpr {
      - traits may contain PII
      - user can request full data export
      - user can request data deletion
      - consent must be recorded
    }
    ccpa {
      - user can opt out of data sale
      - must disclose data collection practices
    }
  }
}

# ============================================
# Standard User Traits
# ============================================

type StandardTraits = {
  # Personal
  email: String? [pii]
  name: String? [pii]
  first_name: String? [pii]
  last_name: String? [pii]
  phone: String? [pii]
  
  # Demographics
  age: Int?
  birthday: Date? [pii]
  gender: String?
  
  # Location
  address: Address? [pii]
  city: String?
  state: String?
  country: String?
  
  # Professional
  title: String?
  company: String?
  industry: String?
  
  # Account
  created_at: Timestamp?
  plan: String?
  logins: Int?
  
  # Custom
  avatar: String?
  website: String?
  description: String?
}

type Address = {
  street: String? [pii]
  city: String?
  state: String?
  postal_code: String? [pii]
  country: String?
}

# ============================================
# Identify Scenarios
# ============================================

scenarios Identify {
  scenario "identify new user" {
    when {
      result = Identify(
        user_id: "user_123",
        traits: {
          "email": "user@example.com",
          "name": "John Doe",
          "plan": "premium",
          "created_at": "2024-01-15T10:30:00Z"
        }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "identify and merge anonymous" {
    given {
      # Anonymous user has tracked some events
      TrackEvent exists with anonymous_id "anon_xyz"
    }
    
    when {
      result = Identify(
        user_id: "user_456",
        anonymous_id: "anon_xyz",
        traits: { "email": "newuser@example.com" }
      )
    }
    
    then {
      result is success
      result.merged == true
      # Anonymous events now attributed to user_456
    }
  }
  
  scenario "update existing user traits" {
    given {
      User "user_789" identified with traits { "plan": "free" }
    }
    
    when {
      result = Identify(
        user_id: "user_789",
        traits: { "plan": "premium" }  # Upgrade
      )
    }
    
    then {
      result is success
      # Plan trait updated to premium
    }
  }
}
