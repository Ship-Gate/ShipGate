// Uploads: Basic file upload
domain UploadsFile {
  version: "1.0.0"

  enum FileStatus {
    PENDING
    PROCESSING
    READY
    FAILED
    DELETED
  }

  entity File {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    name: String
    original_name: String
    mime_type: String
    size: Int
    status: FileStatus
    storage_path: String [secret]
    storage_provider: String
    checksum: String?
    metadata: Map<String, String>
    public_url: String?
    expires_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      size >= 0
      name.length > 0
    }

    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> READY
      PROCESSING -> FAILED
      READY -> DELETED
    }
  }

  behavior UploadFile {
    description: "Upload a file"

    actors {
      User { must: authenticated }
    }

    input {
      file: Binary
      name: String?
      content_type: String?
      folder: String?
      metadata: Map<String, String>?
      public: Boolean?
    }

    output {
      success: File

      errors {
        FILE_TOO_LARGE {
          when: "File exceeds size limit"
          retriable: false
        }
        INVALID_FILE_TYPE {
          when: "File type not allowed"
          retriable: false
        }
        STORAGE_QUOTA_EXCEEDED {
          when: "Storage quota exceeded"
          retriable: false
        }
        UPLOAD_FAILED {
          when: "Upload failed"
          retriable: true
        }
      }
    }

    pre {
      input.file.size > 0
      input.file.size <= 100.megabytes
    }

    post success {
      - File.exists(result.id)
      - result.owner_id == actor.id
      - result.status == READY or result.status == PROCESSING
      - result.size == input.file.size
    }

    temporal {
      - within 30s (p99): upload complete
    }

    security {
      - rate_limit 100 per hour per user
      - virus scan enabled
    }
  }

  behavior GetFile {
    description: "Get file metadata"

    actors {
      User { must: authenticated }
    }

    input {
      file_id: UUID
    }

    output {
      success: File

      errors {
        NOT_FOUND {
          when: "File not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      File.exists(input.file_id)
    }
  }

  behavior DownloadFile {
    description: "Get file download URL"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      file_id: UUID
      expires_in: Duration?
    }

    output {
      success: {
        url: String
        expires_at: Timestamp
      }

      errors {
        NOT_FOUND {
          when: "File not found"
          retriable: false
        }
        NOT_READY {
          when: "File not ready"
          retriable: true
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      File.exists(input.file_id)
      File.lookup(input.file_id).status == READY
    }

    post success {
      - result.expires_at > now()
    }
  }

  behavior DeleteFile {
    description: "Delete a file"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      file_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "File not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      File.exists(input.file_id)
    }

    post success {
      - File.lookup(input.file_id).status == DELETED
    }

    temporal {
      - eventually within 24h: storage freed
    }
  }

  behavior ListFiles {
    description: "List user files"

    actors {
      User { must: authenticated }
    }

    input {
      folder: String?
      mime_type: String?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        files: List<File>
        total_count: Int
        total_size: Int
        has_more: Boolean
      }
    }

    post success {
      - all(f in result.files: f.owner_id == actor.id)
      - all(f in result.files: f.status != DELETED)
    }
  }

  scenarios UploadFile {
    scenario "upload small file" {
      when {
        result = UploadFile(
          file: Binary { size: 1024 },
          name: "document.pdf"
        )
      }

      then {
        result is success
        result.name == "document.pdf"
        result.size == 1024
      }
    }

    scenario "file too large" {
      when {
        result = UploadFile(
          file: Binary { size: 200.megabytes }
        )
      }

      then {
        result is FILE_TOO_LARGE
      }
    }
  }
}
