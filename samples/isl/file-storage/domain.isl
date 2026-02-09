# File / Storage Pipeline — Canonical Sample
# Upload, transform, and serve files with quotas and virus scanning
# Covers: pre/post, invariants, temporal, scenarios

domain FileStorage {
  version: "1.0.0"

  enum FileStatus {
    UPLOADING
    SCANNING
    PROCESSING
    READY
    QUARANTINED
    DELETED
  }

  enum StorageTier {
    HOT
    WARM
    COLD
    ARCHIVE
  }

  entity StorageFile {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    bucket: String [indexed]
    path: String [indexed]
    size_bytes: Int
    content_type: String
    checksum_sha256: String
    status: FileStatus [default: UPLOADING]
    storage_tier: StorageTier [default: HOT]
    uploaded_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      size_bytes >= 0
      size_bytes <= 5_368_709_120
      (bucket, path) is unique
      status == QUARANTINED implies not publicly_accessible
    }
  }

  entity Bucket {
    id: UUID [immutable, unique]
    name: String [unique, indexed]
    owner_id: UUID [indexed]
    max_size_bytes: Int
    used_size_bytes: Int [default: 0]
    is_public: Boolean [default: false]

    invariants {
      used_size_bytes >= 0
      used_size_bytes <= max_size_bytes
      max_size_bytes > 0
    }
  }

  behavior UploadFile {
    description: "Upload a file to a bucket"

    input {
      bucket: String
      path: String
      content: Binary [sensitive]
      content_type: String
    }

    output {
      success: StorageFile
      errors {
        BUCKET_NOT_FOUND {
          when: "Bucket does not exist"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "Upload would exceed bucket's max_size_bytes"
          retriable: false
        }
        PATH_CONFLICT {
          when: "A file already exists at this path"
          retriable: false
        }
        FILE_TOO_LARGE {
          when: "File exceeds 5GB limit"
          retriable: false
        }
        INVALID_CONTENT_TYPE {
          when: "Content type not in bucket's allowlist"
          retriable: false
        }
      }
    }

    pre {
      Bucket.exists(bucket)
      content.size_bytes <= 5_368_709_120
      Bucket.lookup(bucket).used_size_bytes + content.size_bytes <= Bucket.lookup(bucket).max_size_bytes
      not StorageFile.exists_at(bucket, path)
    }

    post success {
      - StorageFile.exists(result.id)
      - result.status == SCANNING
      - result.checksum_sha256 == sha256(input.content)
      - Bucket.lookup(bucket).used_size_bytes == old(used_size_bytes) + result.size_bytes
    }

    invariants {
      - file goes through UPLOADING -> SCANNING -> PROCESSING -> READY pipeline
      - upload is atomic: partial uploads are cleaned up on failure
    }

    temporal {
      within 30s (p99): upload acknowledged
      eventually within 5m: virus scan complete
      eventually within 10m: processing complete and status == READY
    }
  }

  behavior ScanFile {
    description: "Run virus/malware scan on uploaded file"

    input {
      file_id: UUID
    }

    output {
      success: StorageFile
      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
        NOT_SCANNING {
          when: "File is not in SCANNING status"
          retriable: false
        }
        SCAN_FAILED {
          when: "Virus scan engine unavailable"
          retriable: true
          retry_after: 30s
        }
      }
    }

    pre {
      StorageFile.exists(file_id)
      StorageFile.lookup(file_id).status == SCANNING
    }

    post success {
      - result.status in [PROCESSING, QUARANTINED]
      - result.status == QUARANTINED implies malware_detected
    }

    invariants {
      - quarantined files are never served to clients
      - scan result is logged for audit
    }
  }

  behavior DownloadFile {
    description: "Download a file by bucket and path"

    input {
      bucket: String
      path: String
      requesting_user_id: UUID
    }

    output {
      success: {
        content: Binary
        content_type: String
        checksum_sha256: String
      }
      errors {
        FILE_NOT_FOUND {
          when: "No file at this path"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User does not have read access"
          retriable: false
        }
        NOT_READY {
          when: "File is still being processed"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      StorageFile.exists_at(bucket, path)
      StorageFile.lookup_at(bucket, path).status == READY
    }

    post success {
      - result.checksum_sha256 == StorageFile.lookup_at(bucket, path).checksum_sha256
      - result.content_type == StorageFile.lookup_at(bucket, path).content_type
    }

    invariants {
      - checksum verified on every download (integrity guarantee)
      - quarantined files are never downloadable
    }
  }

  behavior DeleteFile {
    description: "Delete a file and reclaim quota"

    input {
      file_id: UUID
    }

    output {
      success: Boolean
      errors {
        FILE_NOT_FOUND {
          when: "File does not exist"
          retriable: false
        }
      }
    }

    pre {
      StorageFile.exists(file_id)
    }

    post success {
      - StorageFile.lookup(file_id).status == DELETED
      - Bucket.lookup(file.bucket).used_size_bytes == old(used_size_bytes) - file.size_bytes
    }

    invariants {
      - quota reclaimed on deletion
      - soft delete: data retained for 30 days before hard purge
    }
  }

  scenario "Upload pipeline lifecycle" {
    step upload = UploadFile({ bucket: "assets", path: "logo.png", content: png_bytes, content_type: "image/png" })
    assert upload.result.status == SCANNING

    step scan = ScanFile({ file_id: upload.result.id })
    assert scan.result.status == PROCESSING

    # After processing completes
    step download = DownloadFile({ bucket: "assets", path: "logo.png", requesting_user_id: owner })
    assert download.result.checksum_sha256 == upload.result.checksum_sha256
  }

  scenario "Quarantined file blocked from download" {
    step upload = UploadFile({ bucket: "docs", path: "malware.exe", content: bad_bytes, content_type: "application/octet-stream" })
    step scan = ScanFile({ file_id: upload.result.id })
    assert scan.result.status == QUARANTINED

    step dl = DownloadFile({ bucket: "docs", path: "malware.exe", requesting_user_id: owner })
    assert dl.error == NOT_READY or dl.error == FILE_NOT_FOUND
  }
}
