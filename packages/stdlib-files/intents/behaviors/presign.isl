// ============================================================================
// Presigned URL Behaviors
// ============================================================================

behavior CreatePresignedUrl {
  description: "Generate a presigned URL for direct storage access"
  
  actors {
    user: authenticated
    service: internal
  }
  
  input {
    file_id: FileId?
    operation: PresignedOperation
    expires_in: Duration { min: 1.minute, max: 7.days }
    conditions: PresignConditions?
    // For uploads without existing file
    key: String?
    content_type: MimeType?
    content_length_range: { min: Int, max: Int }?
  }
  
  output {
    success: PresignedUrlResult
    errors {
      FILE_NOT_FOUND { when: "File ID provided but file doesn't exist" }
      ACCESS_DENIED { }
      INVALID_OPERATION { when: "Operation not supported" }
      INVALID_EXPIRATION { when: "Expiration exceeds maximum" }
    }
  }
  
  preconditions {
    // For GET/DELETE, file must exist
    input.operation in [GET, DELETE, HEAD] implies input.file_id != null
    input.file_id != null implies File.exists(input.file_id)
    
    // For file operations, user must have access
    input.file_id != null implies File.lookup(input.file_id).can_access(actor.id)
    
    // For PUT, need key or file_id
    input.operation == PUT implies (input.key != null or input.file_id != null)
  }
  
  postconditions {
    success implies {
      result.url != null
      result.expires_at > now()
      result.expires_at <= now() + input.expires_in
      result.method == operation_to_method(input.operation)
    }
  }
  
  temporal {
    response within 50.ms (p99)
  }
  
  security {
    requires authentication
    // URLs should not leak sensitive info
    url_must_not_contain: [access_key, secret_key, session_token]
  }
}

behavior CreatePresignedPost {
  description: "Generate presigned POST data for browser uploads"
  
  actors {
    user: authenticated
  }
  
  input {
    folder_id: FolderId?
    file_name: String { max_length: 255 }
    content_type: MimeType
    max_size: FileSize
    expires_in: Duration { min: 1.minute, max: 1.hour }
    metadata: Map<String, String>?
    success_redirect: String?
  }
  
  output {
    success: PresignedPostResult
    errors {
      FOLDER_NOT_FOUND { }
      ACCESS_DENIED { }
      SIZE_TOO_LARGE { when: "Max size exceeds limit" }
      INVALID_CONTENT_TYPE { }
    }
  }
  
  preconditions {
    input.folder_id != null implies Folder.exists(input.folder_id)
    input.max_size <= config.max_file_size
  }
  
  postconditions {
    success implies {
      result.url != null
      result.fields != null
      result.expires_at > now()
    }
  }
  
  temporal {
    response within 100.ms (p99)
  }
}

behavior RefreshPresignedUrl {
  description: "Get a new presigned URL for an existing operation"
  
  input {
    original_url: String
    new_expires_in: Duration { min: 1.minute, max: 7.days }
  }
  
  output {
    success: PresignedUrlResult
    errors {
      INVALID_URL { when: "URL is not a valid presigned URL" }
      URL_EXPIRED { when: "Original URL has expired too long ago" }
      RESOURCE_DELETED { when: "Referenced resource no longer exists" }
    }
  }
  
  postconditions {
    success implies {
      result.url != null
      result.expires_at > now()
    }
  }
}

behavior ValidatePresignedUrl {
  description: "Check if a presigned URL is still valid"
  
  input {
    url: String
  }
  
  output {
    success: PresignedUrlValidation
    errors {
      INVALID_URL { when: "Not a valid presigned URL format" }
    }
  }
  
  postconditions {
    success implies {
      result.is_valid == (result.expires_at > now())
    }
  }
  
  temporal {
    response within 10.ms (p99)
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

enum PresignedOperation {
  GET        // Download file
  PUT        // Upload/replace file
  DELETE     // Delete file
  HEAD       // Get metadata only
}

type PresignConditions = {
  content_type: MimeType?
  content_length_range: { min: Int, max: Int }?
  starts_with: Map<String, String>?
  acl: String?
}

type PresignedUrlResult = {
  url: String
  method: HttpMethod
  expires_at: Timestamp
  headers: Map<String, String>?  // Required headers for request
  file_id: FileId?
}

type PresignedPostResult = {
  url: String
  fields: Map<String, String>  // Form fields to include
  expires_at: Timestamp
  file_id: FileId  // ID of file record created
}

type PresignedUrlValidation = {
  is_valid: Boolean
  expires_at: Timestamp
  time_remaining: Duration?
  operation: PresignedOperation
  resource_exists: Boolean
}

enum HttpMethod {
  GET
  PUT
  POST
  DELETE
  HEAD
}

// Helper function
function operation_to_method(op: PresignedOperation): HttpMethod {
  match op {
    GET => HttpMethod.GET
    PUT => HttpMethod.PUT
    DELETE => HttpMethod.DELETE
    HEAD => HttpMethod.HEAD
  }
}
