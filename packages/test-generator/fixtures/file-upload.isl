// Storage fixture: UploadFile behavior
domain FileStorage {
  version: "1.0.0"

  entity StoredFile {
    id: UUID [immutable]
    filename: String
    content_type: String
    size: Int
    url: String
    checksum: String
    created_at: Timestamp [immutable]
  }

  behavior UploadFile {
    description: "Upload a file to cloud storage"

    input {
      filename: String
      content_type: String
      size: Int
      data: String
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
        FILE_TOO_LARGE {
          when: "File exceeds maximum allowed size"
          retriable: false
        }
        INVALID_TYPE {
          when: "File content type is not allowed"
          retriable: false
        }
        EMPTY_FILE {
          when: "File has zero bytes"
          retriable: false
        }
      }
    }

    preconditions {
      input.size > 0
      input.size <= 10485760
      input.filename.length > 0
    }

    postconditions {
      success implies {
        StoredFile.exists(result.id)
        result.filename == input.filename
        result.content_type == input.content_type
        result.size == input.size
        result.url.length > 0
        result.checksum.length > 0
      }
    }
  }
}
