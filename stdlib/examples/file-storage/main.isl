# File Storage Service Example
# Demonstrates upload modules for a file storage service

domain FileStorage version "1.0.0"

import { ValidateMimeType, CheckFileSafety, ValidateImageMime } from "@isl/stdlib/uploads/validate-mime"
import { StoreBlob, GeneratePresignedUrl, DeleteBlob, ListBlobs } from "@isl/stdlib/uploads/store-blob"
import { InitiateImageUpload, CompleteImageUpload, ResizeImage } from "@isl/stdlib/uploads/upload-image"
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"

# ============================================
# Types
# ============================================

type FileId = UUID { immutable: true, unique: true }

type FileCategory = enum { DOCUMENT, IMAGE, VIDEO, OTHER }

entity StoredFile {
  id: FileId [immutable, unique]
  user_id: UUID [indexed]
  name: String { max_length: 255 }
  category: FileCategory
  blob_id: UUID
  size_bytes: Int
  mime_type: String
  is_public: Boolean [default: false]
  folder_id: UUID?
  created_at: Timestamp [immutable]
}

entity Folder {
  id: UUID [immutable, unique]
  user_id: UUID [indexed]
  name: String { max_length: 100 }
  parent_id: UUID?
  created_at: Timestamp [immutable]
}

# ============================================
# Upload Behaviors
# ============================================

behavior UploadFile {
  description: "Upload any file type securely"

  actors {
    user: User { authenticated: true }
  }

  input {
    filename: String { max_length: 255 }
    content_type: String
    data: Bytes { max_size: 104857600 }  # 100MB
    folder_id: UUID?
  }

  output {
    success: StoredFile
    errors {
      INVALID_FILE { when: "File type not allowed" }
      SIZE_EXCEEDED { when: "File too large" }
      QUOTA_EXCEEDED { when: "Storage quota exceeded" }
      FOLDER_NOT_FOUND { when: "Folder does not exist" }
    }
  }

  flow {
    # Step 1: Validate file safety
    step 1: CheckFileSafety(
      data: input.data[0:8192],  # First 8KB for magic bytes
      filename: input.filename,
      block_executables: true,
      block_archives: false
    )

    # Step 2: Validate MIME type matches
    step 2: ValidateMimeType(
      data: input.data[0:8192],
      claimed_mime: input.content_type,
      filename: input.filename
    )

    # Step 3: Store blob
    step 3: StoreBlob(
      owner_id: user.id,
      bucket: "user-files",
      key: "users/" + user.id + "/" + generate_unique_key(input.filename),
      data: input.data,
      content_type: mime_result.detected_mime,
      filename: input.filename
    )

    # Step 4: Create file record
    step 4: create_file_record(user.id, input.filename, blob.id, input.folder_id)
  }

  post success {
    StoredFile.exists(result.id)
    result.user_id == user.id
  }

  temporal {
    within 60s (p99): response returned
  }
}

behavior UploadImage {
  description: "Upload and process an image"

  actors {
    user: User { authenticated: true }
  }

  input {
    filename: String
    content_type: String
    data: Bytes { max_size: 20971520 }  # 20MB
    generate_thumbnails: Boolean [default: true]
    folder_id: UUID?
  }

  output {
    success: {
      file: StoredFile
      thumbnails: Map<String, String>?
    }
    errors {
      NOT_AN_IMAGE
      FORMAT_NOT_ALLOWED
      SIZE_EXCEEDED
      PROCESSING_FAILED
    }
  }

  flow {
    # Step 1: Validate it's actually an image
    step 1: ValidateImageMime(
      data: input.data[0:8192],
      allowed_formats: ["image/jpeg", "image/png", "image/gif", "image/webp"]
    )

    # Step 2: Store original
    step 2: StoreBlob(
      owner_id: user.id,
      bucket: "user-images",
      key: "users/" + user.id + "/originals/" + generate_key(),
      data: input.data,
      content_type: mime_result.detected_mime
    )

    # Step 3: Generate thumbnails if requested
    step 3 when input.generate_thumbnails: generate_image_thumbnails(blob.id)

    # Step 4: Create file record
    step 4: create_image_record(user.id, blob.id, thumbnails)
  }
}

# ============================================
# Download Behaviors
# ============================================

behavior DownloadFile {
  description: "Get download URL for a file"

  actors {
    user: User { authenticated: true }
  }

  input {
    file_id: FileId
  }

  output {
    success: {
      download_url: String
      expires_at: Timestamp
    }
    errors {
      FILE_NOT_FOUND
      ACCESS_DENIED
    }
  }

  pre {
    StoredFile.exists(file_id)
    StoredFile.lookup(file_id).user_id == user.id or 
      StoredFile.lookup(file_id).is_public
  }

  flow {
    step 1: GeneratePresignedUrl(
      blob_id: file.blob_id,
      expires_in: 1h,
      for_download: true,
      download_filename: file.name
    )
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ShareFile {
  description: "Make file publicly accessible"

  actors {
    user: User { authenticated: true }
  }

  input {
    file_id: FileId
    expires_in: Duration? [default: 7d]
  }

  output {
    success: {
      share_url: String
      expires_at: Timestamp
    }
    errors {
      FILE_NOT_FOUND
      ACCESS_DENIED
    }
  }

  pre {
    StoredFile.exists(file_id)
    StoredFile.lookup(file_id).user_id == user.id
  }

  flow {
    step 1: GeneratePresignedUrl(
      blob_id: file.blob_id,
      expires_in: input.expires_in,
      for_download: true
    )
  }
}

# ============================================
# Management Behaviors
# ============================================

behavior ListFiles {
  description: "List files in folder or root"

  actors {
    user: User { authenticated: true }
  }

  input {
    folder_id: UUID?
    category: FileCategory?
    limit: Int { min: 1, max: 100 } [default: 50]
    offset: Int { min: 0 } [default: 0]
  }

  output {
    success: {
      files: List<StoredFile>
      total_count: Int
      total_size_bytes: Int
    }
  }

  post success {
    forall f in result.files:
      f.user_id == user.id
      f.folder_id == input.folder_id
  }

  temporal {
    within 200ms (p99): response returned
  }
}

behavior DeleteFile {
  description: "Delete a file permanently"

  actors {
    user: User { authenticated: true }
  }

  input {
    file_id: FileId
  }

  output {
    success: Boolean
    errors {
      FILE_NOT_FOUND
      ACCESS_DENIED
      DELETE_FAILED
    }
  }

  pre {
    StoredFile.exists(file_id)
    StoredFile.lookup(file_id).user_id == user.id
  }

  flow {
    step 1: DeleteBlob(blob_id: file.blob_id)
    step 2: delete_file_record(file_id)
  }

  post success {
    not StoredFile.exists(file_id)
  }
}

behavior CreateFolder {
  description: "Create a new folder"

  actors {
    user: User { authenticated: true }
  }

  input {
    name: String { max_length: 100 }
    parent_id: UUID?
  }

  output {
    success: Folder
    errors {
      PARENT_NOT_FOUND
      NAME_EXISTS
    }
  }

  pre {
    input.parent_id == null or Folder.exists(parent_id)
    not Folder.exists_with_name(user.id, input.parent_id, input.name)
  }

  post success {
    Folder.exists(result.id)
    result.name == input.name
    result.parent_id == input.parent_id
  }
}

behavior GetStorageUsage {
  description: "Get user's storage usage"

  actors {
    user: User { authenticated: true }
  }

  output {
    success: {
      total_files: Int
      total_size_bytes: Int
      by_category: Map<FileCategory, Int>
      quota_bytes: Int
      quota_used_percent: Int
    }
  }

  post success {
    result.quota_used_percent == (result.total_size_bytes / result.quota_bytes) * 100
  }

  temporal {
    within 100ms (p99): response returned
  }
}
