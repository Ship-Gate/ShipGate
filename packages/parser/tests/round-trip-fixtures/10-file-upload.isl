domain FileUpload {
  version: "1.0.0"

  type FileSize = Int { min: 0 max: 10485760 }

  entity File {
    id: UUID [immutable, unique]
    name: String
    size: FileSize
    mime_type: String
    storage_path: String
  }

  behavior UploadFile {
    input {
      name: String
      size: Int
      mime_type: String
    }
    output {
      success: File
      errors {
        TOO_LARGE { when: "File exceeds 10MB" retriable: false }
        INVALID_TYPE { when: "Unsupported file type" retriable: false }
      }
    }
    preconditions {
      - input.size >= 0
      - input.size <= 10485760
    }
  }

  behavior GetFile {
    input {
      id: UUID
    }
    output {
      success: File
      errors {
        NOT_FOUND { when: "File not found" retriable: false }
      }
    }
  }
}
