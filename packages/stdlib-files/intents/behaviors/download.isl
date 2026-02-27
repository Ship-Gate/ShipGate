// ============================================================================
// Download Behaviors
// ============================================================================

behavior Download {
  description: "Get a presigned URL to download a file"
  
  actors {
    user: authenticated
  }
  
  input {
    file_id: FileId
    expires_in: Duration { 
      min: 1.minute
      max: 7.days 
    }
    disposition: DownloadDisposition?
    response_content_type: MimeType?
  }
  
  output {
    success: DownloadResult
    errors {
      FILE_NOT_FOUND {
        retriable: false
      }
      ACCESS_DENIED { 
        when: "User doesn't have permission to access this file"
        retriable: false
      }
      FILE_NOT_READY {
        when: "File is still uploading or processing"
        retriable: true
        retry_after: 5.seconds
      }
      FILE_DELETED {
        when: "File has been deleted"
        retriable: false
      }
      FILE_EXPIRED {
        when: "File has passed its expiration date"
        retriable: false
      }
    }
  }
  
  preconditions {
    // File must exist
    File.exists(input.file_id)
    
    // File must be ready
    File.lookup(input.file_id).status == READY
    
    // File must not be expired
    File.lookup(input.file_id).expires_at == null or 
      File.lookup(input.file_id).expires_at > now()
    
    // User must have access
    File.lookup(input.file_id).can_access(actor.id)
  }
  
  postconditions {
    success implies {
      // Download URL provided
      result.download_url != null
      result.download_url.length > 0
      
      // Expiration set correctly
      result.expires_at > now()
      result.expires_at <= now() + input.expires_in
      
      // File info included
      result.file.id == input.file_id
    }
  }
  
  temporal {
    // Fast response for download URL generation
    response within 100.ms (p99)
  }
  
  security {
    requires authentication
  }
  
  observability {
    metrics {
      download_requested: counter { labels: [mime_type, access_level] }
    }
    logs {
      success: info { include: [file_id, name, expires_in], exclude: [download_url] }
    }
  }
}

behavior GetDownloadUrl {
  description: "Simplified download - get URL with default expiration"
  
  input {
    file_id: FileId
  }
  
  output {
    success: { url: String, expires_at: Timestamp }
    errors {
      FILE_NOT_FOUND { }
      ACCESS_DENIED { }
      FILE_NOT_READY { }
    }
  }
  
  preconditions {
    File.exists(input.file_id)
    File.lookup(input.file_id).status == READY
    File.lookup(input.file_id).can_access(actor.id)
  }
  
  postconditions {
    success implies {
      result.url != null
      result.expires_at > now()
      result.expires_at <= now() + 1.hour  // Default 1 hour
    }
  }
  
  temporal {
    response within 50.ms (p99)
  }
}

behavior StreamDownload {
  description: "Get a streaming download for large files"
  
  input {
    file_id: FileId
    range: ByteRange?  // For partial downloads / resume
  }
  
  output {
    success: StreamResult
    errors {
      FILE_NOT_FOUND { }
      ACCESS_DENIED { }
      RANGE_NOT_SATISFIABLE { when: "Requested byte range is invalid" }
    }
  }
  
  preconditions {
    File.exists(input.file_id)
    File.lookup(input.file_id).status == READY
    File.lookup(input.file_id).can_access(actor.id)
    input.range == null or input.range.start < File.lookup(input.file_id).size
  }
  
  postconditions {
    success implies {
      result.content_length > 0
      input.range != null implies result.content_range != null
    }
  }
}

behavior BatchDownload {
  description: "Get download URLs for multiple files"
  
  input {
    file_ids: List<FileId> { max_length: 100 }
    expires_in: Duration { min: 1.minute, max: 1.hour }
  }
  
  output {
    success: List<{ file_id: FileId, url: String?, error: String? }>
    errors {
      EMPTY_LIST { when: "No file IDs provided" }
    }
  }
  
  preconditions {
    input.file_ids.length > 0
  }
  
  postconditions {
    success implies {
      result.length == input.file_ids.length
    }
  }
  
  temporal {
    response within 500.ms (p99)
  }
}

// Supporting types
enum DownloadDisposition {
  INLINE       // Display in browser
  ATTACHMENT   // Force download
}

type ByteRange = {
  start: Int { min: 0 }
  end: Int?  // null = to end of file
}

type StreamResult = {
  content_type: MimeType
  content_length: Int
  content_range: String?
  accept_ranges: String
  stream: BinaryStream
}
