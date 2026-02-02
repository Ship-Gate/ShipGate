// Uploads: Chunked/resumable upload
domain UploadsChunked {
  version: "1.0.0"

  enum UploadStatus {
    INITIATED
    UPLOADING
    COMPLETING
    COMPLETED
    ABORTED
    EXPIRED
  }

  entity ChunkedUpload {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    file_name: String
    mime_type: String
    total_size: Int
    chunk_size: Int
    total_chunks: Int
    uploaded_chunks: List<Int>
    uploaded_bytes: Int
    status: UploadStatus
    storage_path: String [secret]
    expires_at: Timestamp
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      total_size > 0
      chunk_size > 0
      total_chunks > 0
      uploaded_bytes >= 0
      uploaded_bytes <= total_size
      expires_at > created_at
    }

    lifecycle {
      INITIATED -> UPLOADING
      UPLOADING -> COMPLETING
      COMPLETING -> COMPLETED
      INITIATED -> EXPIRED
      UPLOADING -> EXPIRED
      INITIATED -> ABORTED
      UPLOADING -> ABORTED
    }
  }

  behavior InitiateChunkedUpload {
    description: "Start a chunked upload"

    actors {
      User { must: authenticated }
    }

    input {
      file_name: String
      mime_type: String
      total_size: Int
      chunk_size: Int?
      metadata: Map<String, String>?
    }

    output {
      success: {
        upload: ChunkedUpload
        chunk_size: Int
        total_chunks: Int
        upload_urls: List<{ chunk: Int, url: String }>?
      }

      errors {
        FILE_TOO_LARGE {
          when: "File exceeds maximum size"
          retriable: false
        }
        INVALID_CHUNK_SIZE {
          when: "Chunk size is invalid"
          retriable: true
        }
        STORAGE_QUOTA_EXCEEDED {
          when: "Storage quota exceeded"
          retriable: false
        }
      }
    }

    pre {
      input.total_size > 0
      input.total_size <= 5.gigabytes
      input.file_name.length > 0
      input.chunk_size == null or (input.chunk_size >= 5.megabytes and input.chunk_size <= 100.megabytes)
    }

    post success {
      - ChunkedUpload.exists(result.upload.id)
      - result.upload.status == INITIATED
      - result.upload.uploaded_chunks.length == 0
      - result.upload.uploaded_bytes == 0
    }
  }

  behavior UploadChunk {
    description: "Upload a single chunk"

    actors {
      User { must: authenticated }
    }

    input {
      upload_id: UUID
      chunk_number: Int
      data: Binary
      checksum: String?
    }

    output {
      success: {
        chunk_number: Int
        uploaded_bytes: Int
        remaining_chunks: Int
      }

      errors {
        UPLOAD_NOT_FOUND {
          when: "Upload not found"
          retriable: false
        }
        UPLOAD_EXPIRED {
          when: "Upload has expired"
          retriable: false
        }
        INVALID_CHUNK_NUMBER {
          when: "Chunk number is invalid"
          retriable: false
        }
        CHUNK_ALREADY_UPLOADED {
          when: "Chunk already uploaded"
          retriable: false
        }
        CHECKSUM_MISMATCH {
          when: "Checksum does not match"
          retriable: true
        }
        INVALID_CHUNK_SIZE {
          when: "Chunk size is wrong"
          retriable: true
        }
      }
    }

    pre {
      ChunkedUpload.exists(input.upload_id)
      ChunkedUpload.lookup(input.upload_id).status == INITIATED or ChunkedUpload.lookup(input.upload_id).status == UPLOADING
      ChunkedUpload.lookup(input.upload_id).expires_at > now()
      input.chunk_number >= 0
      input.chunk_number < ChunkedUpload.lookup(input.upload_id).total_chunks
      input.chunk_number not in ChunkedUpload.lookup(input.upload_id).uploaded_chunks
    }

    post success {
      - input.chunk_number in ChunkedUpload.lookup(input.upload_id).uploaded_chunks
      - ChunkedUpload.lookup(input.upload_id).uploaded_bytes > old(ChunkedUpload.lookup(input.upload_id).uploaded_bytes)
    }
  }

  behavior CompleteChunkedUpload {
    description: "Complete a chunked upload"

    actors {
      User { must: authenticated }
    }

    input {
      upload_id: UUID
    }

    output {
      success: {
        file_id: UUID
        file_name: String
        size: Int
        mime_type: String
      }

      errors {
        UPLOAD_NOT_FOUND {
          when: "Upload not found"
          retriable: false
        }
        INCOMPLETE_UPLOAD {
          when: "Not all chunks uploaded"
          retriable: true
        }
        ASSEMBLY_FAILED {
          when: "Failed to assemble chunks"
          retriable: true
        }
      }
    }

    pre {
      ChunkedUpload.exists(input.upload_id)
      ChunkedUpload.lookup(input.upload_id).uploaded_chunks.length == ChunkedUpload.lookup(input.upload_id).total_chunks
    }

    post success {
      - ChunkedUpload.lookup(input.upload_id).status == COMPLETED
    }

    temporal {
      - within 30s (p99): assembly complete
    }
  }

  behavior AbortChunkedUpload {
    description: "Abort a chunked upload"

    actors {
      User { must: authenticated }
    }

    input {
      upload_id: UUID
    }

    output {
      success: Boolean

      errors {
        UPLOAD_NOT_FOUND {
          when: "Upload not found"
          retriable: false
        }
        ALREADY_COMPLETED {
          when: "Upload already completed"
          retriable: false
        }
      }
    }

    pre {
      ChunkedUpload.exists(input.upload_id)
      ChunkedUpload.lookup(input.upload_id).status != COMPLETED
    }

    post success {
      - ChunkedUpload.lookup(input.upload_id).status == ABORTED
    }

    temporal {
      - eventually within 1h: chunks cleaned up
    }
  }

  behavior GetUploadStatus {
    description: "Get upload progress"

    actors {
      User { must: authenticated }
    }

    input {
      upload_id: UUID
    }

    output {
      success: {
        upload: ChunkedUpload
        progress_percent: Decimal
        missing_chunks: List<Int>
      }

      errors {
        UPLOAD_NOT_FOUND {
          when: "Upload not found"
          retriable: false
        }
      }
    }

    pre {
      ChunkedUpload.exists(input.upload_id)
    }
  }

  scenarios InitiateChunkedUpload {
    scenario "start large upload" {
      when {
        result = InitiateChunkedUpload(
          file_name: "large-video.mp4",
          mime_type: "video/mp4",
          total_size: 1.gigabyte
        )
      }

      then {
        result is success
        result.total_chunks > 0
        result.upload.status == INITIATED
      }
    }
  }
}
