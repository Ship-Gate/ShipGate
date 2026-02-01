// ============================================================================
// Upload Behaviors
// ============================================================================

behavior Upload {
  description: "Initiate a file upload and get a presigned URL"
  
  actors {
    user: authenticated
  }
  
  input {
    name: String { 
      max_length: 255
      pattern: /^[^<>:"/\\|?*\x00-\x1f]+$/
    }
    folder_id: FolderId?
    mime_type: MimeType
    size: FileSize
    checksum: String { 
      pattern: /^[a-f0-9]{64}$/  // SHA-256 hex
    }
    metadata: Map<String, String>?
    expires_at: Timestamp?
    access_level: AccessLevel?
  }
  
  output {
    success: UploadResult
    errors {
      FOLDER_NOT_FOUND { 
        when: "Specified folder does not exist"
        retriable: false
      }
      QUOTA_EXCEEDED { 
        when: "User's storage quota would be exceeded"
        retriable: false
      }
      FILE_TOO_LARGE { 
        when: "File exceeds maximum allowed size"
        retriable: false
      }
      INVALID_MIME_TYPE { 
        when: "MIME type is not in allowlist"
        retriable: false
      }
      FILE_EXISTS {
        when: "File with same name exists in folder"
        retriable: false
      }
    }
  }
  
  preconditions {
    // Folder must exist if specified
    input.folder_id != null implies Folder.exists(input.folder_id)
    
    // User must have access to folder
    input.folder_id != null implies Folder.lookup(input.folder_id).can_access(actor.id)
    
    // Size must be within limits
    input.size <= config.max_file_size
    input.size > 0
    
    // MIME type must be allowed
    config.allowed_mime_types.is_empty() or input.mime_type in config.allowed_mime_types
    
    // Quota check
    actor.storage_used + input.size <= actor.storage_quota
  }
  
  postconditions {
    success implies {
      // File record created
      File.exists(result.file.id)
      
      // File in uploading state
      result.file.status == UPLOADING
      
      // Upload URL provided
      result.upload_url != null
      result.upload_url.length > 0
      
      // Expiration set
      result.expires_at > now()
      result.expires_at <= now() + 1.hour
      
      // Metadata preserved
      result.file.name == input.name
      result.file.mime_type == input.mime_type
      result.file.size == input.size
      result.file.checksum == input.checksum
      result.file.owner_id == actor.id
    }
  }
  
  temporal {
    // Fast response for upload initiation
    response within 200.ms (p99)
  }
  
  security {
    requires authentication
    rate_limit 100/hour per user
  }
  
  observability {
    metrics {
      upload_initiated: counter { labels: [mime_type, folder_id] }
      upload_size_bytes: histogram { labels: [mime_type] }
    }
    logs {
      success: info { include: [file_id, name, size, mime_type] }
      error: warn { include: [error_code, name, size] }
    }
  }
}

behavior CompleteUpload {
  description: "Mark an upload as complete after data transfer"
  
  actors {
    user: authenticated
  }
  
  input {
    file_id: FileId
    parts: List<UploadPart>?  // For multipart uploads
  }
  
  output {
    success: File
    errors {
      FILE_NOT_FOUND {
        retriable: false
      }
      CHECKSUM_MISMATCH { 
        when: "Uploaded file checksum doesn't match declared checksum"
        retriable: false
      }
      UPLOAD_EXPIRED { 
        when: "Upload URL has expired"
        retriable: false
      }
      SIZE_MISMATCH {
        when: "Uploaded file size doesn't match declared size"
        retriable: false
      }
      UPLOAD_INCOMPLETE {
        when: "Not all parts have been uploaded"
        retriable: true
        retry_after: 5.seconds
      }
      NOT_OWNER {
        when: "User is not the file owner"
        retriable: false
      }
    }
  }
  
  preconditions {
    // File must exist
    File.exists(input.file_id)
    
    // File must be in uploading state
    File.lookup(input.file_id).status == UPLOADING
    
    // User must be the owner
    File.lookup(input.file_id).owner_id == actor.id
    
    // Upload must not be expired
    File.lookup(input.file_id).created_at + config.upload_expiry > now()
  }
  
  postconditions {
    success implies {
      // Status updated to READY
      File.lookup(input.file_id).status == READY
      
      // Updated timestamp set
      File.lookup(input.file_id).updated_at >= old(File.lookup(input.file_id).updated_at)
    }
    
    CHECKSUM_MISMATCH implies {
      // File should be deleted on checksum failure
      File.lookup(input.file_id).status == DELETED
    }
  }
  
  temporal {
    response within 500.ms (p99)
  }
  
  security {
    requires authentication
  }
  
  observability {
    metrics {
      upload_completed: counter { labels: [mime_type, status] }
      upload_duration: histogram { labels: [mime_type] }
    }
  }
}

behavior CancelUpload {
  description: "Cancel an in-progress upload"
  
  input {
    file_id: FileId
  }
  
  output {
    success: Boolean
    errors {
      FILE_NOT_FOUND { }
      UPLOAD_ALREADY_COMPLETE { when: "File is no longer in uploading state" }
      NOT_OWNER { }
    }
  }
  
  preconditions {
    File.exists(input.file_id)
    File.lookup(input.file_id).status == UPLOADING
    File.lookup(input.file_id).owner_id == actor.id
  }
  
  postconditions {
    success implies {
      File.lookup(input.file_id).status == DELETED
    }
  }
}

behavior InitiateMultipartUpload {
  description: "Start a multipart upload for large files"
  
  input {
    name: String { max_length: 255 }
    folder_id: FolderId?
    mime_type: MimeType
    size: FileSize
    checksum: String
    part_size: Int { min: 5242880, max: 5368709120 }  // 5MB - 5GB
  }
  
  output {
    success: {
      file: File
      upload_id: String
      part_urls: List<{ part_number: Int, url: String, expires_at: Timestamp }>
    }
    errors {
      FOLDER_NOT_FOUND { }
      QUOTA_EXCEEDED { }
      FILE_TOO_LARGE { }
    }
  }
  
  postconditions {
    success implies {
      File.exists(result.file.id)
      result.file.status == UPLOADING
      result.part_urls.length > 0
    }
  }
  
  temporal {
    response within 500.ms (p99)
  }
}

// Supporting types
type UploadPart = {
  part_number: Int { min: 1, max: 10000 }
  etag: String
  size: Int
}
