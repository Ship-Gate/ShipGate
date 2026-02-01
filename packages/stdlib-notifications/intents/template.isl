// ============================================================================
// Template Entity
// ============================================================================
// Notification templates with variable interpolation
// ============================================================================

domain Notifications {
  
  entity Template {
    // ========================================================================
    // IDENTITY
    // ========================================================================
    
    id: TemplateId [immutable, unique, indexed]
    
    // ========================================================================
    // CHANNEL & TYPE
    // ========================================================================
    
    channel: NotificationChannel
    category: String?  // e.g., "transactional", "marketing", "alert"
    
    // ========================================================================
    // CONTENT
    // ========================================================================
    
    // Email-specific
    subject: String? {
      max_length: 998  // RFC 5321
    }
    
    // Main content
    body: String {
      max_length: 1048576  // 1MB
    }
    
    // HTML alternative (email)
    html_body: String?
    
    // Plain text fallback
    text_body: String?
    
    // ========================================================================
    // VARIABLES
    // ========================================================================
    
    variables: List<TemplateVariable>
    
    // ========================================================================
    // LOCALIZATION
    // ========================================================================
    
    locale: String { default: "en" }
    fallback_locale: String?
    
    // ========================================================================
    // METADATA
    // ========================================================================
    
    name: String
    description: String?
    version: Int { default: 1 }
    
    // Status
    active: Boolean { default: true }
    
    // Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    // Ownership
    created_by: String
    
    // Tags for organization
    tags: Map<String, String>
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Email requires subject
      channel == EMAIL implies subject != null
      
      // Body is required
      body.length > 0
      
      // HTML body requires text fallback
      html_body != null implies text_body != null
      
      // Variables in body must be declared
      all(extract_variables(body), v => 
        variables.any(vd => vd.name == v)
      )
      
      // Version is positive
      version >= 1
      
      // Locale format
      locale matches /^[a-z]{2}(-[A-Z]{2})?$/
    }
  }
  
  // ==========================================================================
  // TEMPLATE VARIABLE
  // ==========================================================================
  
  type TemplateVariable = {
    name: String {
      pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/
      max_length: 64
    }
    type: VariableType
    required: Boolean { default: true }
    default_value: String?
    description: String?
    validation: String?  // Regex pattern
  }
  
  enum VariableType {
    STRING
    NUMBER
    DATE
    URL
    EMAIL
    PHONE
    CURRENCY
    HTML
  }
  
  // ==========================================================================
  // TEMPLATE OPERATIONS
  // ==========================================================================
  
  behavior CreateTemplate {
    description: "Create a new notification template"
    
    input {
      id: TemplateId
      channel: NotificationChannel
      name: String
      subject: String?
      body: String
      html_body: String?
      text_body: String?
      variables: List<TemplateVariable>?
      locale: String?
      category: String?
      description: String?
      tags: Map<String, String>?
    }
    
    output {
      success: Template
      errors {
        DUPLICATE_ID { when: "Template ID already exists" }
        INVALID_TEMPLATE { when: "Template syntax is invalid" }
        MISSING_SUBJECT { when: "Email template requires subject" }
        INVALID_VARIABLES { when: "Variable declaration is invalid" }
      }
    }
    
    preconditions {
      not Template.exists(input.id)
      input.channel == EMAIL implies input.subject != null
    }
    
    postconditions {
      success implies {
        Template.exists(result.id)
        result.id == input.id
        result.channel == input.channel
        result.active == true
        result.version == 1
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  behavior UpdateTemplate {
    description: "Update an existing template"
    
    input {
      id: TemplateId
      subject: String?
      body: String?
      html_body: String?
      text_body: String?
      variables: List<TemplateVariable>?
      active: Boolean?
      category: String?
      description: String?
      tags: Map<String, String>?
    }
    
    output {
      success: Template
      errors {
        NOT_FOUND { when: "Template does not exist" }
        INVALID_TEMPLATE { when: "Template syntax is invalid" }
      }
    }
    
    preconditions {
      Template.exists(input.id)
    }
    
    postconditions {
      success implies {
        result.version == old(Template.lookup(input.id).version) + 1
        result.updated_at > old(Template.lookup(input.id).updated_at)
      }
    }
  }
  
  behavior DeleteTemplate {
    description: "Delete a template"
    
    input {
      id: TemplateId
    }
    
    output {
      success: Boolean
      errors {
        NOT_FOUND { when: "Template does not exist" }
        IN_USE { when: "Template has pending notifications" }
      }
    }
    
    preconditions {
      Template.exists(input.id)
    }
    
    postconditions {
      success implies not Template.exists(input.id)
    }
  }
  
  behavior GetTemplate {
    description: "Get template by ID"
    
    input {
      id: TemplateId
    }
    
    output {
      success: Template
      errors {
        NOT_FOUND { when: "Template does not exist" }
      }
    }
    
    temporal {
      response within 20.ms (p99)
    }
  }
  
  behavior ListTemplates {
    description: "List templates with filtering"
    
    input {
      channel: NotificationChannel?
      category: String?
      active: Boolean?
      locale: String?
      limit: Int { default: 50, max: 200 }
      cursor: String?
    }
    
    output {
      success: {
        templates: List<Template>
        next_cursor: String?
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  behavior RenderTemplate {
    description: "Render template with variables (preview)"
    
    input {
      id: TemplateId
      variables: Map<String, String>
    }
    
    output {
      success: {
        subject: String?
        body: String
        html_body: String?
      }
      errors {
        NOT_FOUND { when: "Template does not exist" }
        MISSING_VARIABLE { when: "Required variable not provided" }
        INVALID_VARIABLE { when: "Variable value does not match validation" }
      }
    }
    
    temporal {
      response within 50.ms (p99)
    }
  }
  
  behavior ValidateTemplate {
    description: "Validate template syntax without saving"
    
    input {
      channel: NotificationChannel
      subject: String?
      body: String
      variables: List<TemplateVariable>?
    }
    
    output {
      success: {
        valid: Boolean
        errors: List<{
          location: String
          message: String
        }>
        detected_variables: List<String>
      }
    }
    
    temporal {
      response within 50.ms (p99)
    }
  }
}
