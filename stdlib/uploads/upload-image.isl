# Upload Image Module
# Provides image upload and processing behaviors

module UploadImage version "1.0.0"

# ============================================
# Types
# ============================================

type ImageId = UUID { immutable: true, unique: true }

type ImageFormat = enum { JPEG, PNG, GIF, WEBP, AVIF, SVG }

type ImageSize = {
  width: Int { min: 1, max: 10000 }
  height: Int { min: 1, max: 10000 }
}

type ImageQuality = Int { min: 1, max: 100 }

type ThumbnailSize = enum { SMALL, MEDIUM, LARGE, XLARGE }

type ByteSize = Int { min: 0 }

# ============================================
# Entities
# ============================================

entity Image {
  id: ImageId [immutable, unique]
  user_id: UUID [indexed]
  filename: String { max_length: 255 }
  original_filename: String { max_length: 255 }
  format: ImageFormat
  mime_type: String
  size_bytes: ByteSize
  width: Int
  height: Int
  storage_path: String
  storage_bucket: String
  public_url: String?
  thumbnails: Map<ThumbnailSize, String>?
  metadata: Map<String, String>?
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    size_bytes > 0
    width > 0
    height > 0
    filename.length > 0
  }
}

entity ImageUploadSession {
  id: UUID [immutable, unique]
  user_id: UUID [indexed]
  upload_url: String
  expires_at: Timestamp
  max_size_bytes: ByteSize
  allowed_formats: List<ImageFormat>
  completed: Boolean [default: false]
  image_id: ImageId?
  created_at: Timestamp [immutable]

  invariants {
    expires_at > created_at
    completed implies image_id != null
  }
}

# ============================================
# Behaviors
# ============================================

behavior InitiateImageUpload {
  description: "Create a signed upload URL for image upload"

  input {
    user_id: UUID
    filename: String { max_length: 255 }
    content_type: String
    max_size_bytes: ByteSize? [default: 10485760]  # 10MB
    allowed_formats: List<ImageFormat>? [default: [JPEG, PNG, GIF, WEBP]]
  }

  output {
    success: {
      session_id: UUID
      upload_url: String
      expires_at: Timestamp
    }

    errors {
      USER_NOT_FOUND {
        when: "User does not exist"
        retriable: false
      }
      INVALID_CONTENT_TYPE {
        when: "Content type not allowed"
        retriable: false
      }
      SIZE_LIMIT_EXCEEDED {
        when: "Max size exceeds allowed limit"
        retriable: false
      }
      QUOTA_EXCEEDED {
        when: "User storage quota exceeded"
        retriable: false
      }
    }
  }

  pre {
    User.exists(user_id)
    filename.length > 0
    input.max_size_bytes <= 52428800  # 50MB absolute max
  }

  post success {
    ImageUploadSession.exists(result.session_id)
    result.expires_at == now() + 15m
    result.upload_url.contains("signed")
  }

  temporal {
    within 500ms (p99): response returned
  }

  security {
    rate_limit 100 per hour per user_id
  }
}

behavior CompleteImageUpload {
  description: "Complete upload and process image"

  input {
    session_id: UUID
    generate_thumbnails: Boolean [default: true]
    thumbnail_sizes: List<ThumbnailSize>? [default: [SMALL, MEDIUM]]
  }

  output {
    success: Image

    errors {
      SESSION_NOT_FOUND {
        when: "Upload session does not exist"
        retriable: false
      }
      SESSION_EXPIRED {
        when: "Upload session has expired"
        retriable: false
      }
      UPLOAD_NOT_FOUND {
        when: "No file uploaded to session"
        retriable: true
        retry_after: 5s
      }
      INVALID_IMAGE {
        when: "Uploaded file is not a valid image"
        retriable: false
      }
      FORMAT_NOT_ALLOWED {
        when: "Image format not in allowed list"
        retriable: false
      }
      SIZE_EXCEEDED {
        when: "Image exceeds size limit"
        retriable: false
      }
      PROCESSING_FAILED {
        when: "Image processing failed"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    ImageUploadSession.exists(session_id)
    ImageUploadSession.lookup(session_id).expires_at > now()
    ImageUploadSession.lookup(session_id).completed == false
  }

  post success {
    Image.exists(result.id)
    ImageUploadSession.lookup(session_id).completed == true
    ImageUploadSession.lookup(session_id).image_id == result.id
    input.generate_thumbnails implies result.thumbnails != null
  }

  invariants {
    original file scanned for malware
    exif data stripped for privacy
    image optimized for web
  }

  temporal {
    within 10s (p99): response returned
    eventually within 1m: all thumbnails generated
  }
}

behavior UploadImageDirect {
  description: "Direct image upload (for small images)"

  input {
    user_id: UUID
    filename: String { max_length: 255 }
    content_type: String
    data: Bytes { max_size: 5242880 }  # 5MB max for direct
    generate_thumbnails: Boolean [default: true]
  }

  output {
    success: Image

    errors {
      USER_NOT_FOUND {
        when: "User does not exist"
        retriable: false
      }
      INVALID_IMAGE {
        when: "Data is not a valid image"
        retriable: false
      }
      FORMAT_NOT_ALLOWED {
        when: "Image format not allowed"
        retriable: false
      }
      SIZE_EXCEEDED {
        when: "Image exceeds size limit"
        retriable: false
      }
      QUOTA_EXCEEDED {
        when: "User storage quota exceeded"
        retriable: false
      }
    }
  }

  pre {
    User.exists(user_id)
    input.data.size <= 5242880
  }

  post success {
    Image.exists(result.id)
    result.user_id == input.user_id
    result.original_filename == input.filename
  }

  invariants {
    data scanned for malware
    exif data stripped
  }

  temporal {
    within 5s (p99): response returned
  }

  security {
    rate_limit 50 per hour per user_id
  }
}

behavior ResizeImage {
  description: "Resize an existing image"

  input {
    image_id: ImageId
    target_size: ImageSize
    maintain_aspect_ratio: Boolean [default: true]
    quality: ImageQuality [default: 85]
    output_format: ImageFormat?
  }

  output {
    success: Image  # New resized image

    errors {
      IMAGE_NOT_FOUND {
        when: "Image does not exist"
        retriable: false
      }
      INVALID_DIMENSIONS {
        when: "Target dimensions invalid"
        retriable: false
      }
      PROCESSING_FAILED {
        when: "Resize operation failed"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    Image.exists(image_id)
    input.target_size.width > 0
    input.target_size.height > 0
  }

  post success {
    Image.exists(result.id)
    result.id != input.image_id  # New image created
    input.maintain_aspect_ratio implies 
      result.width / result.height == old_image.width / old_image.height
  }

  temporal {
    within 10s (p99): response returned
  }
}

behavior DeleteImage {
  description: "Delete an image and its thumbnails"

  input {
    image_id: ImageId
  }

  output {
    success: Boolean

    errors {
      IMAGE_NOT_FOUND {
        when: "Image does not exist"
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
    Image.exists(image_id)
  }

  post success {
    not Image.exists(image_id)
    all thumbnails deleted from storage
    storage space reclaimed
  }

  temporal {
    within 5s (p99): response returned
    eventually within 1m: storage fully cleaned
  }
}

behavior GetImage {
  description: "Retrieve image metadata"

  input {
    image_id: ImageId
  }

  output {
    success: Image

    errors {
      IMAGE_NOT_FOUND {
        when: "Image does not exist"
        retriable: false
      }
    }
  }

  post success {
    result.id == input.image_id
  }

  temporal {
    within 50ms (p99): response returned
  }
}

behavior ListUserImages {
  description: "List all images for a user"

  input {
    user_id: UUID
    limit: Int { min: 1, max: 100 } [default: 20]
    offset: Int { min: 0 } [default: 0]
    format: ImageFormat?
  }

  output {
    success: {
      images: List<Image>
      total_count: Int
      total_size_bytes: ByteSize
    }
  }

  pre {
    User.exists(user_id)
  }

  post success {
    result.images.length <= input.limit
    forall img in result.images:
      img.user_id == input.user_id
      input.format == null or img.format == input.format
  }

  temporal {
    within 200ms (p99): response returned
  }
}
