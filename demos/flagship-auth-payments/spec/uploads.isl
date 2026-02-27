# File Upload Domain
# 
# Defines behavioral contracts for secure file uploads including
# presigned URLs, virus scanning, image processing, and storage management.

domain FileUploads {
  version: "1.0.0"
  owner: "flagship-demo"

  # ============================================
  # Types
  # ============================================

  type FileId = UUID { immutable: true, unique: true }
  type UserId = UUID { immutable: true }
  type FileSize = Int { min: 0, max: 104857600 }
  type MimeType = String { max_length: 127 }
  type Url = String { format: url, max_length: 2048 }

  # ============================================
  # Enums
  # ============================================

  enum FileStatus {
    PENDING_UPLOAD
    UPLOADING
    SCANNING
    PROCESSING
    READY
    FAILED
    QUARANTINED
    DELETED
  }

  enum FileCategory {
    IMAGE
    DOCUMENT
    VIDEO
    AUDIO
    ARCHIVE
    OTHER
  }

  enum ScanResult {
    CLEAN
    INFECTED
    SUSPICIOUS
    SCAN_FAILED
  }

  # ============================================
  # Entities
  # ============================================

  entity File {
    id: FileId [immutable, unique]
    user_id: UserId [indexed]
    filename: String
    original_filename: String
    mime_type: MimeType [indexed]
    size: FileSize
    category: FileCategory [indexed]
    status: FileStatus [indexed]
    storage_path: String [secret]
    public_url: Url?
    checksum_sha256: String
    scan_result: ScanResult?
    metadata: Map<String, String>?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    expires_at: Timestamp?

    invariants {
      size >= 0
      filename.length > 0
      status == READY implies public_url != null
      status == QUARANTINED implies scan_result in [INFECTED, SUSPICIOUS]
      expires_at != null implies expires_at > created_at
    }

    lifecycle {
      PENDING_UPLOAD -> UPLOADING
      UPLOADING -> SCANNING
      SCANNING -> PROCESSING
      SCANNING -> QUARANTINED
      PROCESSING -> READY
      PROCESSING -> FAILED
      READY -> DELETED
      QUARANTINED -> DELETED
      FAILED -> DELETED
    }
  }

  entity UploadSession {
    id: UUID [immutable, unique]
    file_id: FileId [indexed]
    user_id: UserId [indexed]
    presigned_url: Url [secret]
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    completed: Boolean [default: false]

    invariants {
      expires_at > created_at
    }
  }

  entity ImageVariant {
    id: UUID [immutable, unique]
    file_id: FileId [indexed]
    variant_name: String
    width: Int
    height: Int
    format: String
    storage_path: String [secret]
    public_url: Url
    created_at: Timestamp [immutable]

    invariants {
      width > 0
      height > 0
      variant_name.length > 0
    }
  }

  # ============================================
  # Behaviors
  # ============================================

  behavior InitiateUpload {
    description: "Start a file upload by getting a presigned URL"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      filename: String
      mime_type: MimeType
      size: FileSize
      category: FileCategory?
      metadata: Map<String, String>?
    }

    output {
      success: {
        file_id: FileId
        upload_url: Url
        expires_in: Int
        max_size: FileSize
      }

      errors {
        FILE_TOO_LARGE {
          when: "File size exceeds maximum allowed"
          retriable: false
        }
        INVALID_MIME_TYPE {
          when: "MIME type is not allowed"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "User storage quota exceeded"
          retriable: false
        }
        INVALID_FILENAME {
          when: "Filename contains invalid characters"
          retriable: true
        }
      }
    }

    pre {
      filename.length > 0
      filename.length <= 255
      size > 0
      size <= 100.megabytes
      mime_type in allowed_mime_types
    }

    post success {
      - File.exists(result.file_id)
      - File.status == PENDING_UPLOAD
      - File.user_id == actor.id
      - UploadSession.exists with file_id and presigned_url
      - result.expires_in > 0
    }

    post QUOTA_EXCEEDED {
      - no File created
      - no UploadSession created
    }

    temporal {
      - within 500ms (p99): response returned
    }

    security {
      - presigned_url expires within 15 minutes
      - rate_limit 60 per minute per user
    }
  }

  behavior CompleteUpload {
    description: "Mark an upload as complete and trigger processing"

    actors {
      User {
        must: authenticated
        owns: file_id
      }
      System {
        for: callback_from_storage
      }
    }

    input {
      file_id: FileId
      checksum: String?
      etag: String?
    }

    output {
      success: File { status: SCANNING }

      errors {
        FILE_NOT_FOUND {
          when: "File record does not exist"
          retriable: false
        }
        UPLOAD_EXPIRED {
          when: "Upload session has expired"
          retriable: false
        }
        CHECKSUM_MISMATCH {
          when: "File checksum does not match expected"
          retriable: true
        }
        UPLOAD_NOT_STARTED {
          when: "No upload was initiated for this file"
          retriable: false
        }
      }
    }

    pre {
      File.exists(file_id)
      File.status in [PENDING_UPLOAD, UPLOADING]
      UploadSession.exists with file_id
      UploadSession.expires_at > now()
    }

    post success {
      - File.status == SCANNING
      - UploadSession.completed == true
      - virus_scan job queued
    }

    post CHECKSUM_MISMATCH {
      - File.status == FAILED
      - file deleted from storage
    }

    temporal {
      - within 1s (p99): response returned
      - eventually within 5m: virus scan completed
    }
  }

  behavior ProcessFile {
    description: "Process a file after virus scan (generate thumbnails, etc.)"

    actors {
      System {
        for: file_processing
      }
    }

    input {
      file_id: FileId
      scan_result: ScanResult
    }

    output {
      success: File { status: READY }

      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        FILE_INFECTED {
          when: "Virus scan detected malware"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "File processing failed"
          retriable: true
          retry_after: 1m
        }
      }
    }

    pre {
      File.exists(file_id)
      File.status == SCANNING
    }

    post success {
      - File.status == READY
      - File.scan_result == CLEAN
      - File.public_url != null
      - File.category == IMAGE implies ImageVariant.count >= 1
    }

    post FILE_INFECTED {
      - File.status == QUARANTINED
      - File.scan_result in [INFECTED, SUSPICIOUS]
      - File.public_url == null
      - file moved to quarantine storage
      - security alert triggered
    }

    temporal {
      - within 30s (p50): image processing complete
      - within 2m (p99): all processing complete
    }
  }

  behavior GetFile {
    description: "Get file metadata and download URL"

    actors {
      User {
        must: authenticated
      }
      Anonymous {
        when: file is public
      }
    }

    input {
      file_id: FileId
      variant: String?
    }

    output {
      success: {
        file: File
        download_url: Url
        expires_in: Int
      }

      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User does not have permission to access file"
          retriable: false
        }
        FILE_NOT_READY {
          when: "File is still processing"
          retriable: true
          retry_after: 5s
        }
        VARIANT_NOT_FOUND {
          when: "Requested variant does not exist"
          retriable: false
        }
      }
    }

    pre {
      file_id.is_valid_format
    }

    post success {
      - File.status == READY
      - result.download_url is signed
      - result.expires_in > 0
      - access logged
    }

    temporal {
      - within 50ms (p50): response returned
      - within 200ms (p99): response returned
    }

    security {
      - download_url expires within 1 hour
      - rate_limit 1000 per minute per user
    }
  }

  behavior DeleteFile {
    description: "Delete a file and all its variants"

    actors {
      User {
        must: authenticated
        owns: file_id
      }
      Admin {
        must: authenticated
        has_permission: file_admin
      }
    }

    input {
      file_id: FileId
      permanent: Boolean?
    }

    output {
      success: {
        deleted: Boolean
        variants_deleted: Int
      }

      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User does not have permission to delete file"
          retriable: false
        }
      }
    }

    pre {
      File.exists(file_id)
      File.user_id == actor.id or actor.has_permission(file_admin)
    }

    post success {
      - File.status == DELETED
      - File deleted from storage
      - all ImageVariant for file_id deleted
      - result.deleted == true
    }

    temporal {
      - within 500ms (p99): response returned
      - eventually within 24h: storage reclaimed
    }
  }

  behavior ListFiles {
    description: "List files for a user with pagination"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      user_id: UserId?
      category: FileCategory?
      status: FileStatus?
      limit: Int?
      cursor: String?
    }

    output {
      success: {
        files: List<File>
        next_cursor: String?
        total_count: Int
      }

      errors {
        INVALID_CURSOR {
          when: "Pagination cursor is invalid"
          retriable: false
        }
      }
    }

    pre {
      input.limit == null or (input.limit > 0 and input.limit <= 100)
    }

    post success {
      - all files in result owned by requesting user (unless admin)
      - result.files.length <= (input.limit or 20)
      - total_count >= result.files.length
    }

    temporal {
      - within 100ms (p50): response returned
      - within 500ms (p99): response returned
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios InitiateUpload {
    scenario "successful image upload initiation" {
      given {
        user = User.create(storage_used: 0, storage_quota: 1.gigabyte)
      }

      when {
        result = InitiateUpload(
          filename: "photo.jpg",
          mime_type: "image/jpeg",
          size: 5242880,
          category: IMAGE
        )
      }

      then {
        result is success
        result.upload_url.starts_with("https://")
        result.expires_in > 0
      }
    }

    scenario "upload rejected - file too large" {
      when {
        result = InitiateUpload(
          filename: "huge-file.zip",
          mime_type: "application/zip",
          size: 500000000
        )
      }

      then {
        result is FILE_TOO_LARGE
      }
    }

    scenario "upload rejected - invalid mime type" {
      when {
        result = InitiateUpload(
          filename: "script.exe",
          mime_type: "application/x-executable",
          size: 1024
        )
      }

      then {
        result is INVALID_MIME_TYPE
      }
    }
  }

  scenarios ProcessFile {
    scenario "successful image processing" {
      given {
        file = File.create(status: SCANNING, category: IMAGE, mime_type: "image/jpeg")
      }

      when {
        result = ProcessFile(file_id: file.id, scan_result: CLEAN)
      }

      then {
        result is success
        file.status == READY
        ImageVariant.count(file_id: file.id) >= 1
      }
    }

    scenario "infected file quarantined" {
      given {
        file = File.create(status: SCANNING, mime_type: "application/pdf")
      }

      when {
        result = ProcessFile(file_id: file.id, scan_result: INFECTED)
      }

      then {
        result is FILE_INFECTED
        file.status == QUARANTINED
        file.public_url == null
      }
    }
  }

  # ============================================
  # Global Invariants
  # ============================================

  invariants UploadSecurity {
    description: "Security invariants for file uploads"
    scope: global

    always {
      - all uploads scanned for malware
      - infected files never served
      - presigned URLs expire within 15 minutes
      - storage paths never exposed to clients
      - file access logged with user context
      - quarantined files isolated from clean storage
    }
  }
}
