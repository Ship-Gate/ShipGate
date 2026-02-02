// Uploads: Presigned URL generation
domain UploadsPresigned {
  version: "1.0.0"

  enum UrlType {
    UPLOAD
    DOWNLOAD
  }

  entity PresignedUrl {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    type: UrlType
    bucket: String
    key: String
    url: String
    expires_at: Timestamp
    conditions: Map<String, String>?
    used: Boolean [default: false]
    used_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
      used implies used_at != null
    }
  }

  behavior GenerateUploadUrl {
    description: "Generate presigned URL for upload"

    actors {
      User { must: authenticated }
    }

    input {
      file_name: String
      content_type: String?
      max_size: Int?
      expires_in: Duration?
      metadata: Map<String, String>?
    }

    output {
      success: {
        url: String
        fields: Map<String, String>
        key: String
        expires_at: Timestamp
      }

      errors {
        INVALID_FILE_TYPE {
          when: "File type not allowed"
          retriable: false
        }
        SIZE_LIMIT_EXCEEDED {
          when: "Size limit too large"
          retriable: false
        }
      }
    }

    pre {
      input.file_name.length > 0
      input.max_size == null or (input.max_size > 0 and input.max_size <= 5.gigabytes)
      input.expires_in == null or (input.expires_in >= 1.minute and input.expires_in <= 7.days)
    }

    post success {
      - result.expires_at > now()
      - result.key.length > 0
    }
  }

  behavior GenerateDownloadUrl {
    description: "Generate presigned URL for download"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      file_id: UUID?
      key: String?
      expires_in: Duration?
      filename: String?
      inline: Boolean?
    }

    output {
      success: {
        url: String
        expires_at: Timestamp
      }

      errors {
        FILE_NOT_FOUND {
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
      input.file_id != null or input.key != null
      input.expires_in == null or (input.expires_in >= 1.minute and input.expires_in <= 7.days)
    }

    post success {
      - result.expires_at > now()
    }
  }

  behavior GenerateBatchUrls {
    description: "Generate multiple presigned URLs"

    actors {
      User { must: authenticated }
    }

    input {
      files: List<{
        file_name: String
        content_type: String?
        max_size: Int?
      }>
      expires_in: Duration?
    }

    output {
      success: List<{
        file_name: String
        url: String
        fields: Map<String, String>
        key: String
        expires_at: Timestamp
      }>

      errors {
        TOO_MANY_FILES {
          when: "Too many files requested"
          retriable: false
        }
        INVALID_FILE_TYPE {
          when: "File type not allowed"
          retriable: false
        }
      }
    }

    pre {
      input.files.length > 0
      input.files.length <= 100
    }

    post success {
      - result.length == input.files.length
    }
  }

  behavior ConfirmUpload {
    description: "Confirm presigned upload completed"

    actors {
      User { must: authenticated }
      System { }
    }

    input {
      key: String
      checksum: String?
    }

    output {
      success: {
        file_id: UUID
        size: Int
        mime_type: String
      }

      errors {
        KEY_NOT_FOUND {
          when: "Upload key not found"
          retriable: false
        }
        UPLOAD_NOT_COMPLETE {
          when: "Upload not complete"
          retriable: true
        }
        CHECKSUM_MISMATCH {
          when: "Checksum does not match"
          retriable: false
        }
      }
    }

    pre {
      input.key.length > 0
    }

    post success {
      - result.size > 0
    }
  }

  behavior RevokeUrl {
    description: "Revoke a presigned URL"

    actors {
      User { must: authenticated }
    }

    input {
      url_id: UUID
    }

    output {
      success: Boolean

      errors {
        URL_NOT_FOUND {
          when: "URL not found"
          retriable: false
        }
        ALREADY_USED {
          when: "URL already used"
          retriable: false
        }
      }
    }

    pre {
      PresignedUrl.exists(input.url_id)
      PresignedUrl.lookup(input.url_id).used == false
    }

    post success {
      - not PresignedUrl.exists(input.url_id) or PresignedUrl.lookup(input.url_id).expires_at < now()
    }
  }

  scenarios GenerateUploadUrl {
    scenario "generate for image" {
      when {
        result = GenerateUploadUrl(
          file_name: "photo.jpg",
          content_type: "image/jpeg",
          max_size: 10.megabytes,
          expires_in: 1.hour
        )
      }

      then {
        result is success
        result.url contains "presigned"
        result.expires_at > now()
      }
    }

    scenario "generate batch" {
      when {
        result = GenerateBatchUrls(
          files: [
            { file_name: "doc1.pdf" },
            { file_name: "doc2.pdf" },
            { file_name: "doc3.pdf" }
          ]
        )
      }

      then {
        result is success
        result.length == 3
      }
    }
  }
}
