# File Uploads Domain
# Complete file upload management with validation, storage, and processing

domain FileUploads {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type FileSize = Int { min: 0 }
  type MimeType = String { max_length: 255 }
  type FilePath = String { max_length: 1024 }
  type FileHash = String { length: 64 }  # SHA-256
  
  enum UploadStatus {
    PENDING
    UPLOADING
    PROCESSING
    COMPLETED
    FAILED
    DELETED
  }
  
  enum StorageProvider {
    S3
    GCS
    AZURE_BLOB
    LOCAL
  }
  
  enum ProcessingStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
    SKIPPED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity File {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    original_filename: String { max_length: 255 }
    stored_filename: String { max_length: 255 }
    mime_type: MimeType
    size: FileSize
    hash: FileHash [indexed]
    storage_provider: StorageProvider
    storage_path: FilePath
    storage_bucket: String?
    public_url: String?
    is_public: Boolean [default: false]
    metadata: Map<String, String>
    upload_status: UploadStatus
    processing_status: ProcessingStatus [default: PENDING]
    expires_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    deleted_at: Timestamp?
    
    invariants {
      size >= 0
      deleted_at != null implies upload_status == DELETED
      expires_at == null or expires_at > created_at
    }
    
    lifecycle {
      PENDING -> UPLOADING
      UPLOADING -> PROCESSING
      UPLOADING -> COMPLETED
      UPLOADING -> FAILED
      PROCESSING -> COMPLETED
      PROCESSING -> FAILED
      COMPLETED -> DELETED
      FAILED -> DELETED
    }
  }
  
  entity UploadSession {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    filename: String
    mime_type: MimeType
    total_size: FileSize
    uploaded_size: FileSize [default: 0]
    chunk_size: FileSize
    total_chunks: Int
    uploaded_chunks: List<Int>
    upload_url: String?
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    
    invariants {
      uploaded_size <= total_size
      uploaded_chunks.length <= total_chunks
      expires_at > created_at
    }
  }
  
  entity FileVariant {
    id: UUID [immutable, unique]
    file_id: UUID [indexed]
    variant_name: String { max_length: 100 }
    mime_type: MimeType
    size: FileSize
    storage_path: FilePath
    width: Int?
    height: Int?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    
    invariants {
      width == null or width > 0
      height == null or height > 0
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior InitiateUpload {
    description: "Start a new file upload session"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      filename: String
      mime_type: MimeType
      size: FileSize
      metadata: Map<String, String>?
    }
    
    output {
      success: {
        session: UploadSession
        upload_url: String
        headers: Map<String, String>
      }
      
      errors {
        FILE_TOO_LARGE {
          when: "File exceeds maximum allowed size"
          retriable: false
        }
        INVALID_MIME_TYPE {
          when: "File type not allowed"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "User storage quota exceeded"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many upload requests"
          retriable: true
          retry_after: 1m
        }
      }
    }
    
    preconditions {
      input.size > 0
      input.size <= config.max_file_size
      input.mime_type in config.allowed_mime_types
    }
    
    postconditions {
      success implies {
        UploadSession.exists(result.session.id)
        result.upload_url != null
      }
    }
    
    security {
      rate_limit 100 per hour per user
    }
  }
  
  behavior UploadChunk {
    description: "Upload a chunk of a multipart upload"
    
    actors {
      User { must: authenticated, owns: session }
    }
    
    input {
      session_id: UUID
      chunk_number: Int
      data: Binary
    }
    
    output {
      success: {
        session: UploadSession
        uploaded_chunks: Int
        remaining_chunks: Int
      }
      
      errors {
        SESSION_NOT_FOUND {
          when: "Upload session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Upload session has expired"
          retriable: false
        }
        INVALID_CHUNK {
          when: "Chunk number out of range or already uploaded"
          retriable: false
        }
        CHUNK_TOO_LARGE {
          when: "Chunk exceeds maximum size"
          retriable: false
        }
      }
    }
    
    preconditions {
      UploadSession.exists(input.session_id)
      UploadSession.lookup(input.session_id).expires_at > now()
      input.chunk_number not in UploadSession.lookup(input.session_id).uploaded_chunks
    }
    
    postconditions {
      success implies {
        input.chunk_number in UploadSession.lookup(input.session_id).uploaded_chunks
      }
    }
  }
  
  behavior CompleteUpload {
    description: "Complete a multipart upload and create the file"
    
    actors {
      User { must: authenticated, owns: session }
    }
    
    input {
      session_id: UUID
    }
    
    output {
      success: File
      
      errors {
        SESSION_NOT_FOUND {
          when: "Upload session does not exist"
          retriable: false
        }
        INCOMPLETE_UPLOAD {
          when: "Not all chunks have been uploaded"
          retriable: true
        }
        HASH_MISMATCH {
          when: "File hash doesn't match expected value"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "File processing failed"
          retriable: true
        }
      }
    }
    
    preconditions {
      UploadSession.exists(input.session_id)
      UploadSession.lookup(input.session_id).uploaded_chunks.length == 
        UploadSession.lookup(input.session_id).total_chunks
    }
    
    postconditions {
      success implies {
        File.exists(result.id)
        File.lookup(result.id).upload_status == COMPLETED or 
        File.lookup(result.id).upload_status == PROCESSING
      }
    }
    
    temporal {
      response within 30s
      eventually within 5m: processing_completed
    }
  }
  
  behavior DirectUpload {
    description: "Upload a file directly (small files)"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      filename: String
      mime_type: MimeType
      data: Binary
      is_public: Boolean?
      metadata: Map<String, String>?
    }
    
    output {
      success: File
      
      errors {
        FILE_TOO_LARGE {
          when: "File exceeds direct upload limit"
          retriable: false
        }
        INVALID_MIME_TYPE {
          when: "File type not allowed"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "User storage quota exceeded"
          retriable: false
        }
        UPLOAD_FAILED {
          when: "Storage provider error"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.data.size <= config.direct_upload_max_size
      input.mime_type in config.allowed_mime_types
    }
    
    postconditions {
      success implies {
        File.exists(result.id)
        File.lookup(result.id).upload_status == COMPLETED
        File.lookup(result.id).size == input.data.size
      }
    }
    
    invariants {
      file content scanned for malware
      file hash computed and stored
    }
  }
  
  behavior GetDownloadUrl {
    description: "Get a signed URL for downloading a file"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      file_id: UUID
      expires_in: Int? [default: 3600, max: 86400]
      variant: String?
    }
    
    output {
      success: {
        url: String
        expires_at: Timestamp
        headers: Map<String, String>?
      }
      
      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User cannot access this file"
          retriable: false
        }
        VARIANT_NOT_FOUND {
          when: "Requested variant does not exist"
          retriable: false
        }
      }
    }
    
    preconditions {
      File.exists(input.file_id)
      File.lookup(input.file_id).upload_status == COMPLETED
    }
  }
  
  behavior DeleteFile {
    description: "Delete a file and its variants"
    
    actors {
      User { must: authenticated, owns: file }
      Admin { must: authenticated }
    }
    
    input {
      file_id: UUID
      permanent: Boolean [default: false]
    }
    
    output {
      success: Boolean
      
      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        DELETE_FAILED {
          when: "Failed to delete from storage"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        File.lookup(input.file_id).upload_status == DELETED
        input.permanent implies not File.exists(input.file_id)
      }
    }
    
    temporal {
      eventually within 24h: storage_freed
    }
  }
  
  behavior ProcessImage {
    description: "Generate image variants (thumbnails, resized versions)"
    
    actors {
      System { }
    }
    
    input {
      file_id: UUID
      variants: List<{
        name: String
        width: Int?
        height: Int?
        format: String?
        quality: Int?
      }>
    }
    
    output {
      success: List<FileVariant>
      
      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        NOT_AN_IMAGE {
          when: "File is not an image"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "Image processing failed"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        result.length == input.variants.length
        result.all(v => FileVariant.exists(v.id))
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios DirectUpload {
    scenario "upload image file" {
      when {
        result = DirectUpload(
          filename: "photo.jpg",
          mime_type: "image/jpeg",
          data: binary_data,
          is_public: false
        )
      }
      
      then {
        result is success
        result.upload_status == COMPLETED
        result.mime_type == "image/jpeg"
      }
    }
    
    scenario "rejected invalid type" {
      when {
        result = DirectUpload(
          filename: "script.exe",
          mime_type: "application/x-executable",
          data: binary_data
        )
      }
      
      then {
        result is INVALID_MIME_TYPE
      }
    }
  }
}
