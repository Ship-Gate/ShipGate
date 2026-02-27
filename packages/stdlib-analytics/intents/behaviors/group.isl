# Group Behavior
# Associate users with groups/companies

import { Analytics } from "../domain.isl"

behavior Group {
  description: "Associate a user with a group or company"
  
  actors {
    Application {
      for: b2b_tracking
    }
  }
  
  input {
    user_id: UserId
    group_id: GroupId
    traits: Map<String, Any>?
    context: Context?
  }
  
  output {
    success: {
      id: TrackingId
    }
    
    errors {
      INVALID_USER_ID {
        when: "User ID is empty or invalid"
        retriable: false
      }
      INVALID_GROUP_ID {
        when: "Group ID is empty or invalid"
        retriable: false
      }
    }
  }
  
  preconditions {
    input.user_id != null
    input.user_id.length > 0
    input.group_id != null
    input.group_id.length > 0
  }
  
  postconditions {
    success implies {
      - GroupEvent.exists(result.id)
      - user_associated_with_group(input.user_id, input.group_id)
      - group_traits_updated(input.group_id, input.traits)
    }
  }
  
  invariants {
    - user can belong to multiple groups
    - group traits are shared across all users in group
    - group association is idempotent
  }
  
  temporal {
    - within 5ms (p99): returns to caller
    - eventually within 60s: association stored
  }
}

# ============================================
# Standard Group Traits
# ============================================

type StandardGroupTraits = {
  # Company Info
  name: String?
  industry: String?
  employees: Int?
  website: String?
  
  # Plan/Subscription
  plan: String?
  monthly_spend: Decimal?
  
  # Dates
  created_at: Timestamp?
  
  # Address
  address: Address?
  city: String?
  state: String?
  country: String?
}

# ============================================
# Alias Behavior
# ============================================

behavior Alias {
  description: "Merge two user identities"
  
  actors {
    Application {
      for: identity_management
    }
  }
  
  input {
    previous_id: String   # Old identifier
    user_id: UserId       # New identifier
    context: Context?
  }
  
  output {
    success: {
      id: TrackingId
    }
    
    errors {
      INVALID_PREVIOUS_ID {
        when: "Previous ID is empty"
        retriable: false
      }
      INVALID_USER_ID {
        when: "User ID is empty"
        retriable: false
      }
      ALIAS_CONFLICT {
        when: "Previous ID already aliased to different user"
        retriable: false
      }
    }
  }
  
  preconditions {
    input.previous_id != null
    input.previous_id.length > 0
    input.user_id != null
    input.user_id.length > 0
    input.previous_id != input.user_id
  }
  
  postconditions {
    success implies {
      - AliasEvent.exists(result.id)
      - events_from(input.previous_id) attributed to input.user_id
      - future events with previous_id attributed to user_id
    }
  }
  
  invariants {
    - alias is permanent (cannot be undone)
    - events merged retroactively
    - alias is idempotent for same pair
  }
}

# ============================================
# Group Scenarios
# ============================================

scenarios Group {
  scenario "associate user with company" {
    when {
      result = Group(
        user_id: "user_123",
        group_id: "company_acme",
        traits: {
          "name": "Acme Corp",
          "industry": "Technology",
          "employees": 500,
          "plan": "enterprise"
        }
      )
    }
    
    then {
      result is success
    }
  }
  
  scenario "add user to team" {
    when {
      result = Group(
        user_id: "user_456",
        group_id: "team_engineering",
        traits: {
          "name": "Engineering",
          "department": "Product"
        }
      )
    }
    
    then {
      result is success
    }
  }
}

scenarios Alias {
  scenario "merge anonymous to identified" {
    when {
      result = Alias(
        previous_id: "anon_abc123",
        user_id: "user_789"
      )
    }
    
    then {
      result is success
      # All events from anon_abc123 now attributed to user_789
    }
  }
  
  scenario "merge after email login" {
    given {
      User logged in via email after browsing as guest
    }
    
    when {
      result = Alias(
        previous_id: "guest_session_xyz",
        user_id: "user_email_login"
      )
    }
    
    then {
      result is success
    }
  }
}
