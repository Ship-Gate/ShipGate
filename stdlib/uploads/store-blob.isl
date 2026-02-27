# Store Blob Module
# Provides blob storage behaviors

module StoreBlob version "1.0.0"

# ============================================
# Types
# ============================================

type BlobId = UUID { immutable: true, unique: true }

type StorageProvider = enum { S3, GCS, AZURE, LOCAL, MINIO }

type StorageClass = enum { 
  STANDARD
  INFREQUENT_ACCESS
  ARCHIVE
  DEEP_ARCHIVE
}

type ByteSize = Int { min: 0 }

type ContentHash = String { length: 64 }  # SHA-256

type PresignedUrlDuration = Duration { min: 1m, max: 7d }

# ============================================
# Entities
# ============================================

entity Blob {
  id: BlobId [immutable, unique]
  owner_id: UUID [indexed]
  bucket: String [indexed]
  key: String [indexed]  # Full path in storage
  filename: String { max_length: 255 }
  content_type: String
  size_bytes: ByteSize
  content_hash: ContentHash
  storage_provider: StorageProvider
  storage_class: StorageClass [default: STANDARD]
  is_public: Boolean [default: false]
  public_url: String?
  metadata: Map<String, String>?
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  expires_at: Timestamp?  # For auto-deletion

  invariants {
    size_bytes >= 0
    is_public implies public_url != null
    key.length > 0
  }
}

entity StorageBucket {
  name: String [unique]
  provider: StorageProvider
  region: String
  is_public: Boolean [default: false]
  max_object_size: ByteSize
  allowed_content_types: List<String>?
  created_at: Timestamp [immutable]
}

entity UploadPart {
  id: UUID [immutable, unique]
  upload_id: String [indexed]
  part_number: Int { min: 1, max: 10000 }
  size_bytes: ByteSize
  etag: String
  uploaded_at: Timestamp

  invariants {
    part_number > 0
    size_bytes > 0
  }
}

# ============================================
# Behaviors
# ============================================

behavior StoreBlob {
  description: "Store a blob in object storage"

  input {
    owner_id: UUID
    bucket: String
    key: String
    data: Bytes
    content_type: String
    filename: String?
    storage_class: StorageClass? [default: STANDARD]
    metadata: Map<String, String>?
    is_public: Boolean [default: false]
    expires_at: Timestamp?
  }

  output {
    success: Blob

    errors {
      BUCKET_NOT_FOUND {
        when: "Storage bucket does not exist"
        retriable: false
      }
      KEY_EXISTS {
        when: "Object with this key already exists"
        retriable: false
      }
      SIZE_EXCEEDED {
        when: "Object exceeds bucket size limit"
        retriable: false
      }
      CONTENT_TYPE_NOT_ALLOWED {
        when: "Content type not allowed in bucket"
        retriable: false
      }
      QUOTA_EXCEEDED {
        when: "Storage quota exceeded"
        retriable: false
      }
      UPLOAD_FAILED {
        when: "Failed to upload to storage"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    StorageBucket.exists(bucket)
    input.data.size <= StorageBucket.lookup(bucket).max_object_size
    key.length > 0
  }

  post success {
    Blob.exists(result.id)
    result.key == input.key
    result.bucket == input.bucket
    result.content_hash == sha256(input.data)
    result.size_bytes == input.data.size
    input.is_public implies result.public_url != null
  }

  temporal {
    within 30s (p99): response returned
  }

  security {
    rate_limit 100 per minute per owner_id
  }
}

behavior InitiateMultipartUpload {
  description: "Start a multipart upload for large files"

  input {
    owner_id: UUID
    bucket: String
    key: String
    content_type: String
    filename: String?
    metadata: Map<String, String>?
  }

  output {
    success: {
      upload_id: String
      bucket: String
      key: String
      part_size: ByteSize  # Recommended part size
    }

    errors {
      BUCKET_NOT_FOUND {
        when: "Storage bucket does not exist"
        retriable: false
      }
      KEY_EXISTS {
        when: "Object with this key already exists"
        retriable: false
      }
    }
  }

  pre {
    StorageBucket.exists(bucket)
    key.length > 0
  }

  post success {
    result.upload_id.length > 0
    result.part_size >= 5242880  # 5MB minimum
  }

  temporal {
    within 5s (p99): response returned
  }
}

behavior UploadPart {
  description: "Upload a part of a multipart upload"

  input {
    upload_id: String
    part_number: Int { min: 1, max: 10000 }
    data: Bytes
  }

  output {
    success: {
      part_number: Int
      etag: String
      size_bytes: ByteSize
    }

    errors {
      UPLOAD_NOT_FOUND {
        when: "Multipart upload does not exist"
        retriable: false
      }
      INVALID_PART_NUMBER {
        when: "Part number out of range"
        retriable: false
      }
      PART_TOO_SMALL {
        when: "Part size below minimum (except last part)"
        retriable: false
      }
      UPLOAD_FAILED {
        when: "Failed to upload part"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    upload_id.length > 0
    part_number >= 1
    part_number <= 10000
  }

  post success {
    result.part_number == input.part_number
    result.etag.length > 0
    result.size_bytes == input.data.size
    UploadPart.exists(upload_id, part_number)
  }

  temporal {
    within 60s (p99): response returned
  }
}

behavior CompleteMultipartUpload {
  description: "Complete a multipart upload"

  input {
    upload_id: String
    parts: List<{ part_number: Int, etag: String }>
  }

  output {
    success: Blob

    errors {
      UPLOAD_NOT_FOUND {
        when: "Multipart upload does not exist"
        retriable: false
      }
      PARTS_MISMATCH {
        when: "Parts list does not match uploaded parts"
        retriable: false
      }
      COMPLETION_FAILED {
        when: "Failed to complete upload"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    upload_id.length > 0
    parts.length > 0
    parts.is_sorted_by(part_number)
  }

  post success {
    Blob.exists(result.id)
    result.size_bytes == sum(UploadPart.where(upload_id).size_bytes)
  }

  temporal {
    within 30s (p99): response returned
  }
}

behavior AbortMultipartUpload {
  description: "Abort a multipart upload and clean up parts"

  input {
    upload_id: String
  }

  output {
    success: Boolean

    errors {
      UPLOAD_NOT_FOUND {
        when: "Multipart upload does not exist"
        retriable: false
      }
    }
  }

  pre {
    upload_id.length > 0
  }

  post success {
    forall p in UploadPart.where(upload_id):
      not UploadPart.exists(p.id)
  }

  temporal {
    within 10s (p99): response returned
  }
}

behavior GetBlob {
  description: "Retrieve blob metadata"

  input {
    blob_id: BlobId
  }

  output {
    success: Blob

    errors {
      BLOB_NOT_FOUND {
        when: "Blob does not exist"
        retriable: false
      }
    }
  }

  post success {
    result.id == input.blob_id
  }

  temporal {
    within 50ms (p99): response returned
  }
}

behavior GetBlobContent {
  description: "Download blob content"

  input {
    blob_id: BlobId
    range: { start: ByteSize, end: ByteSize }?  # For partial download
  }

  output {
    success: {
      data: Bytes
      content_type: String
      size_bytes: ByteSize
      is_partial: Boolean
    }

    errors {
      BLOB_NOT_FOUND {
        when: "Blob does not exist"
        retriable: false
      }
      DOWNLOAD_FAILED {
        when: "Failed to download from storage"
        retriable: true
        retry_after: 5s
      }
      INVALID_RANGE {
        when: "Byte range is invalid"
        retriable: false
      }
    }
  }

  pre {
    Blob.exists(blob_id)
    input.range == null or input.range.end > input.range.start
  }

  post success {
    input.range != null implies result.is_partial == true
    input.range == null implies result.size_bytes == Blob.lookup(blob_id).size_bytes
  }

  temporal {
    within 30s (p99): response returned
  }
}

behavior GeneratePresignedUrl {
  description: "Generate a presigned URL for direct access"

  input {
    blob_id: BlobId
    expires_in: PresignedUrlDuration [default: 1h]
    for_download: Boolean [default: true]
    download_filename: String?  # Override filename in Content-Disposition
  }

  output {
    success: {
      url: String
      expires_at: Timestamp
    }

    errors {
      BLOB_NOT_FOUND {
        when: "Blob does not exist"
        retriable: false
      }
      PRESIGN_FAILED {
        when: "Failed to generate presigned URL"
        retriable: true
        retry_after: 1s
      }
    }
  }

  pre {
    Blob.exists(blob_id)
    input.expires_in >= 1m
    input.expires_in <= 7d
  }

  post success {
    result.url.contains("signature")
    result.expires_at == now() + input.expires_in
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior DeleteBlob {
  description: "Delete a blob from storage"

  input {
    blob_id: BlobId
  }

  output {
    success: Boolean

    errors {
      BLOB_NOT_FOUND {
        when: "Blob does not exist"
        retriable: false
      }
      DELETE_FAILED {
        when: "Failed to delete from storage"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    Blob.exists(blob_id)
  }

  post success {
    not Blob.exists(blob_id)
  }

  temporal {
    within 5s (p99): response returned
  }
}

behavior CopyBlob {
  description: "Copy a blob to a new location"

  input {
    source_blob_id: BlobId
    destination_bucket: String
    destination_key: String
    new_storage_class: StorageClass?
  }

  output {
    success: Blob

    errors {
      SOURCE_NOT_FOUND {
        when: "Source blob does not exist"
        retriable: false
      }
      DESTINATION_EXISTS {
        when: "Destination already exists"
        retriable: false
      }
      COPY_FAILED {
        when: "Copy operation failed"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    Blob.exists(source_blob_id)
    StorageBucket.exists(destination_bucket)
  }

  post success {
    Blob.exists(result.id)
    result.bucket == input.destination_bucket
    result.key == input.destination_key
    result.content_hash == Blob.lookup(source_blob_id).content_hash
  }

  temporal {
    within 60s (p99): response returned
  }
}

behavior ListBlobs {
  description: "List blobs in a bucket"

  input {
    bucket: String
    prefix: String?
    owner_id: UUID?
    limit: Int { min: 1, max: 1000 } [default: 100]
    continuation_token: String?
  }

  output {
    success: {
      blobs: List<Blob>
      total_size_bytes: ByteSize
      continuation_token: String?
      has_more: Boolean
    }
  }

  pre {
    StorageBucket.exists(bucket)
  }

  post success {
    result.blobs.length <= input.limit
    forall b in result.blobs:
      b.bucket == input.bucket
      input.prefix == null or b.key.starts_with(input.prefix)
      input.owner_id == null or b.owner_id == input.owner_id
  }

  temporal {
    within 500ms (p99): response returned
  }
}
