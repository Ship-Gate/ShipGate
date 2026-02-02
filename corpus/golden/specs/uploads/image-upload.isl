// Uploads: Image upload with processing
domain UploadsImage {
  version: "1.0.0"

  enum ImageStatus {
    UPLOADING
    PROCESSING
    READY
    FAILED
  }

  type ImageVariant = {
    name: String
    width: Int?
    height: Int?
    format: String
    quality: Int?
    url: String
  }

  entity Image {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    name: String
    original_name: String
    mime_type: String
    size: Int
    width: Int
    height: Int
    status: ImageStatus
    storage_path: String [secret]
    variants: List<ImageVariant>
    blurhash: String?
    dominant_color: String?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]

    invariants {
      size > 0
      width > 0
      height > 0
      mime_type starts_with "image/"
    }

    lifecycle {
      UPLOADING -> PROCESSING
      PROCESSING -> READY
      PROCESSING -> FAILED
    }
  }

  behavior UploadImage {
    description: "Upload and process an image"

    actors {
      User { must: authenticated }
    }

    input {
      file: Binary
      name: String?
      variants: List<{
        name: String
        width: Int?
        height: Int?
        format: String?
        quality: Int?
      }>?
      generate_blurhash: Boolean?
      extract_metadata: Boolean?
    }

    output {
      success: Image

      errors {
        NOT_AN_IMAGE {
          when: "File is not a valid image"
          retriable: false
        }
        IMAGE_TOO_LARGE {
          when: "Image exceeds size limit"
          retriable: false
        }
        UNSUPPORTED_FORMAT {
          when: "Image format not supported"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "Image processing failed"
          retriable: true
        }
        STORAGE_QUOTA_EXCEEDED {
          when: "Storage quota exceeded"
          retriable: false
        }
      }
    }

    pre {
      input.file.size > 0
      input.file.size <= 50.megabytes
      input.file.mime_type starts_with "image/"
    }

    post success {
      - Image.exists(result.id)
      - result.owner_id == actor.id
      - result.width > 0 and result.height > 0
    }

    temporal {
      - within 10s (p99): upload complete
      - eventually within 30s: variants generated
    }
  }

  behavior GetImage {
    description: "Get image details"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      image_id: UUID
    }

    output {
      success: Image

      errors {
        NOT_FOUND {
          when: "Image not found"
          retriable: false
        }
      }
    }

    pre {
      Image.exists(input.image_id)
    }
  }

  behavior GetImageUrl {
    description: "Get URL for image variant"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      image_id: UUID
      variant: String?
      width: Int?
      height: Int?
      format: String?
      quality: Int?
    }

    output {
      success: {
        url: String
        width: Int
        height: Int
        format: String
      }

      errors {
        NOT_FOUND {
          when: "Image not found"
          retriable: false
        }
        NOT_READY {
          when: "Image not ready"
          retriable: true
        }
        VARIANT_NOT_FOUND {
          when: "Variant not found"
          retriable: false
        }
      }
    }

    pre {
      Image.exists(input.image_id)
      Image.lookup(input.image_id).status == READY
    }
  }

  behavior GenerateVariant {
    description: "Generate new image variant"

    actors {
      User { must: authenticated }
    }

    input {
      image_id: UUID
      name: String
      width: Int?
      height: Int?
      format: String?
      quality: Int?
      fit: String?
    }

    output {
      success: ImageVariant

      errors {
        NOT_FOUND {
          when: "Image not found"
          retriable: false
        }
        VARIANT_EXISTS {
          when: "Variant already exists"
          retriable: false
        }
        INVALID_DIMENSIONS {
          when: "Invalid dimensions"
          retriable: true
        }
      }
    }

    pre {
      Image.exists(input.image_id)
      input.width == null or input.width > 0
      input.height == null or input.height > 0
      input.quality == null or (input.quality >= 1 and input.quality <= 100)
    }

    post success {
      - result.name == input.name
    }

    temporal {
      - within 5s (p99): variant generated
    }
  }

  behavior DeleteImage {
    description: "Delete an image"

    actors {
      User { must: authenticated }
    }

    input {
      image_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Image not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Image.exists(input.image_id)
      Image.lookup(input.image_id).owner_id == actor.id
    }

    post success {
      - not Image.exists(input.image_id)
    }
  }

  scenarios UploadImage {
    scenario "upload with variants" {
      when {
        result = UploadImage(
          file: Binary { mime_type: "image/jpeg", size: 2.megabytes },
          variants: [
            { name: "thumbnail", width: 150, height: 150 },
            { name: "medium", width: 800 },
            { name: "large", width: 1920 }
          ],
          generate_blurhash: true
        )
      }

      then {
        result is success
        result.variants.length == 3
        result.blurhash != null
      }
    }
  }
}
