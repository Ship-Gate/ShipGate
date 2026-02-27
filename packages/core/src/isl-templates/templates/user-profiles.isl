# User Profile Management Domain
# Complete user profile with settings, preferences, and account management

domain UserProfiles {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type Username = String { min_length: 3, max_length: 30, pattern: "^[a-zA-Z0-9_]+$" }
  type DisplayName = String { max_length: 100 }
  type Bio = String { max_length: 500 }
  type AvatarUrl = String { format: "uri", max_length: 2048 }
  type Timezone = String { max_length: 64 }
  type Locale = String { max_length: 10 }
  
  enum ProfileVisibility {
    PUBLIC
    PRIVATE
    FRIENDS_ONLY
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity UserProfile {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    username: Username [unique, indexed]
    display_name: DisplayName?
    bio: Bio?
    avatar_url: AvatarUrl?
    cover_image_url: AvatarUrl?
    website: String?
    location: String?
    company: String?
    job_title: String?
    visibility: ProfileVisibility [default: PUBLIC]
    custom_fields: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      username.length >= 3
    }
  }
  
  entity UserSettings {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    timezone: Timezone [default: "UTC"]
    locale: Locale [default: "en"]
    date_format: String [default: "YYYY-MM-DD"]
    time_format: String [default: "HH:mm"]
    email_notifications: Boolean [default: true]
    push_notifications: Boolean [default: true]
    marketing_emails: Boolean [default: false]
    theme: String [default: "system"]
    accessibility: {
      reduced_motion: Boolean
      high_contrast: Boolean
      font_size: String
    }
    privacy: {
      show_online_status: Boolean
      show_activity: Boolean
      allow_search_indexing: Boolean
    }
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity UsernameHistory {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    old_username: Username [indexed]
    new_username: Username
    changed_at: Timestamp [immutable]
  }
  
  entity ProfileView {
    id: UUID [immutable, unique]
    profile_id: UUID [indexed]
    viewer_id: UUID? [indexed]
    viewer_ip: String?
    viewed_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateProfile {
    description: "Create a new user profile"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      username: Username
      display_name: DisplayName?
    }
    
    output {
      success: UserProfile
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        PROFILE_EXISTS {
          when: "Profile already exists for this user"
          retriable: false
        }
        USERNAME_TAKEN {
          when: "Username is already in use"
          retriable: false
        }
        USERNAME_RESERVED {
          when: "Username is reserved"
          retriable: false
        }
        USERNAME_INVALID {
          when: "Username contains invalid characters"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.user_id)
      not UserProfile.exists(user_id: input.user_id)
      not UserProfile.exists(username: input.username)
      input.username not in reserved_usernames
    }
    
    postconditions {
      success implies {
        UserProfile.exists(result.id)
        UserSettings.exists(user_id: input.user_id)
      }
    }
  }
  
  behavior GetProfile {
    description: "Get a user profile by username or ID"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      username: Username?
      user_id: UUID?
    }
    
    output {
      success: {
        profile: UserProfile
        is_own_profile: Boolean
        follower_count: Int?
        following_count: Int?
      }
      
      errors {
        PROFILE_NOT_FOUND {
          when: "Profile does not exist"
          retriable: false
        }
        PROFILE_PRIVATE {
          when: "Profile is private"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.username != null or input.user_id != null
    }
    
    postconditions {
      success implies {
        // Record profile view if not own profile
        not result.is_own_profile implies ProfileView.created
      }
    }
  }
  
  behavior UpdateProfile {
    description: "Update user profile information"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      display_name: DisplayName?
      bio: Bio?
      avatar_url: AvatarUrl?
      cover_image_url: AvatarUrl?
      website: String?
      location: String?
      company: String?
      job_title: String?
      visibility: ProfileVisibility?
      custom_fields: Map<String, String>?
    }
    
    output {
      success: UserProfile
      
      errors {
        PROFILE_NOT_FOUND {
          when: "Profile does not exist"
          retriable: false
        }
        INVALID_URL {
          when: "One or more URLs are invalid"
          retriable: false
        }
        BIO_TOO_LONG {
          when: "Bio exceeds maximum length"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        UserProfile.lookup(actor.profile_id).updated_at == now()
      }
    }
  }
  
  behavior ChangeUsername {
    description: "Change user's username"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      new_username: Username
      password: String [sensitive]
    }
    
    output {
      success: UserProfile
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        USERNAME_TAKEN {
          when: "Username is already in use"
          retriable: false
        }
        USERNAME_RESERVED {
          when: "Username is reserved"
          retriable: false
        }
        CHANGE_TOO_SOON {
          when: "Username was changed too recently"
          retriable: true
          retry_after: remaining_cooldown
        }
      }
    }
    
    preconditions {
      not UserProfile.exists(username: input.new_username)
      last_username_change > 30.days ago or is_first_change
    }
    
    postconditions {
      success implies {
        UserProfile.lookup(actor.profile_id).username == input.new_username
        UsernameHistory.exists(
          user_id: actor.id,
          old_username: old_username,
          new_username: input.new_username
        )
      }
    }
    
    effects {
      AuditLog { log_username_change }
    }
  }
  
  behavior UpdateSettings {
    description: "Update user settings"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      timezone: Timezone?
      locale: Locale?
      date_format: String?
      time_format: String?
      email_notifications: Boolean?
      push_notifications: Boolean?
      marketing_emails: Boolean?
      theme: String?
      accessibility: Map<String, Any>?
      privacy: Map<String, Any>?
    }
    
    output {
      success: UserSettings
      
      errors {
        INVALID_TIMEZONE {
          when: "Timezone is not valid"
          retriable: false
        }
        INVALID_LOCALE {
          when: "Locale is not supported"
          retriable: false
        }
      }
    }
  }
  
  behavior GetSettings {
    description: "Get user settings"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: UserSettings
    }
  }
  
  behavior UploadAvatar {
    description: "Upload a new avatar image"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      image: Binary
      content_type: String
    }
    
    output {
      success: {
        avatar_url: AvatarUrl
        thumbnails: Map<String, AvatarUrl>
      }
      
      errors {
        INVALID_IMAGE {
          when: "File is not a valid image"
          retriable: false
        }
        IMAGE_TOO_LARGE {
          when: "Image exceeds maximum size"
          retriable: false
        }
        INVALID_DIMENSIONS {
          when: "Image dimensions are invalid"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        UserProfile.lookup(actor.profile_id).avatar_url == result.avatar_url
      }
    }
    
    effects {
      Storage { upload_image }
      ImageProcessing { generate_thumbnails }
    }
  }
  
  behavior SearchProfiles {
    description: "Search for user profiles"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      query: String
      filters: {
        location: String?
        company: String?
      }?
      limit: Int [default: 20, max: 100]
      cursor: String?
    }
    
    output {
      success: {
        profiles: List<UserProfile>
        next_cursor: String?
        total_count: Int
      }
    }
    
    temporal {
      response within 200ms (p99)
    }
  }
  
  behavior CheckUsernameAvailability {
    description: "Check if a username is available"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      username: Username
    }
    
    output {
      success: {
        available: Boolean
        suggestions: List<Username>?
      }
    }
    
    temporal {
      response within 50ms
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios ChangeUsername {
    scenario "successful change" {
      given {
        profile = UserProfile.create(
          user_id: user.id,
          username: "oldname"
        )
      }
      
      when {
        result = ChangeUsername(
          new_username: "newname",
          password: "correct_password"
        )
      }
      
      then {
        result is success
        result.username == "newname"
        UsernameHistory.exists(old_username: "oldname")
      }
    }
    
    scenario "username taken" {
      given {
        existing = UserProfile.create(username: "taken")
      }
      
      when {
        result = ChangeUsername(
          new_username: "taken",
          password: "correct_password"
        )
      }
      
      then {
        result is USERNAME_TAKEN
      }
    }
  }
}
