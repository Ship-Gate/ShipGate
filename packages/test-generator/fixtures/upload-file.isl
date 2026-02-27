// Upload domain fixture: File upload behavior
domain Storage {
  version: "1.0.0"
  
  entity File {
    id: UUID [immutable]
    filename: String
    content_type: String
    size: Int
    url: String
    checksum: String
    created_at: Timestamp [immutable]
  }
  
  behavior UploadFile {
    description: "Upload a file to storage"
    
    input {
      filename: String
      content_type: String
      file: {
        size: Int
        data: String
      }
    }
    
    output {
      success: {
        id: UUID
        url: String
        filename: String
        content_type: String
        size: Int
        checksum: String
      }
      
      errors {
        INVALID_FILE_TYPE {
          when: "File type is not allowed"
          retriable: false
        }
        FILE_TOO_LARGE {
          when: "File exceeds size limit"
          retriable: false
        }
        EMPTY_FILE {
          when: "File is empty"
          retriable: false
        }
        STORAGE_ERROR {
          when: "Storage service error"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.content_type in ["image/jpeg", "image/png", "image/gif", "application/pdf"]
      input.file.size > 0
      input.file.size <= 10485760
      input.filename.length > 0
    }
    
    postconditions {
      success implies {
        File.exists(result.id)
        result.url != null
        result.content_type == input.content_type
        result.size == input.file.size
      }
    }
  }
}
