// Uploads: Avatar/profile picture
domain UploadsAvatar {
  version: "1.0.0"

  type AvatarVariants = {
    small: String
    medium: String
    large: String
    original: String
  }

  entity Avatar {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    original_url: String
    variants: AvatarVariants
    blurhash: String?
    dominant_color: String?
    width: Int
    height: Int
    size: Int
    mime_type: String
    created_at: Timestamp [immutable]

    invariants {
      width > 0
      height > 0
      size > 0
    }
  }

  behavior UploadAvatar {
    description: "Upload user avatar"

    actors {
      User { must: authenticated }
    }

    input {
      file: Binary
      crop: {
        x: Int
        y: Int
        width: Int
        height: Int
      }?
    }

    output {
      success: Avatar

      errors {
        NOT_AN_IMAGE {
          when: "File is not a valid image"
          retriable: false
        }
        IMAGE_TOO_SMALL {
          when: "Image dimensions too small"
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
        INVALID_CROP {
          when: "Crop region is invalid"
          retriable: true
        }
      }
    }

    pre {
      input.file.size > 0
      input.file.size <= 10.megabytes
      input.file.mime_type starts_with "image/"
    }

    post success {
      - Avatar.exists(result.id)
      - result.user_id == actor.id
      - result.variants.small != null
      - result.variants.medium != null
      - result.variants.large != null
    }

    invariants {
      - old avatar is deleted when new one uploaded
    }

    temporal {
      - within 5s (p99): processing complete
    }
  }

  behavior GetAvatar {
    description: "Get user avatar"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      user_id: UUID
      size: String?
    }

    output {
      success: {
        url: String
        blurhash: String?
      }

      errors {
        USER_NOT_FOUND {
          when: "User not found"
          retriable: false
        }
        NO_AVATAR {
          when: "User has no avatar"
          retriable: false
        }
      }
    }
  }

  behavior DeleteAvatar {
    description: "Remove user avatar"

    actors {
      User { must: authenticated }
    }

    input {
      user_id: UUID?
    }

    output {
      success: Boolean

      errors {
        NO_AVATAR {
          when: "No avatar to delete"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      input.user_id == null implies Avatar.exists(user_id: actor.id)
      input.user_id != null implies Avatar.exists(user_id: input.user_id)
    }

    post success {
      - not Avatar.exists(user_id: actor.id)
    }
  }

  behavior GetAvatarUploadUrl {
    description: "Get presigned URL for avatar upload"

    actors {
      User { must: authenticated }
    }

    input {
      content_type: String?
    }

    output {
      success: {
        upload_url: String
        callback_url: String
        expires_at: Timestamp
      }
    }

    post success {
      - result.expires_at > now()
    }
  }

  scenarios UploadAvatar {
    scenario "upload square image" {
      when {
        result = UploadAvatar(
          file: Binary { 
            mime_type: "image/jpeg", 
            size: 500.kilobytes,
            width: 500,
            height: 500
          }
        )
      }

      then {
        result is success
        result.width == 500
        result.height == 500
      }
    }

    scenario "upload with crop" {
      when {
        result = UploadAvatar(
          file: Binary { 
            mime_type: "image/png", 
            size: 1.megabyte,
            width: 1000,
            height: 800
          },
          crop: { x: 100, y: 50, width: 600, height: 600 }
        )
      }

      then {
        result is success
      }
    }

    scenario "too small" {
      when {
        result = UploadAvatar(
          file: Binary { 
            mime_type: "image/jpeg",
            width: 50,
            height: 50
          }
        )
      }

      then {
        result is IMAGE_TOO_SMALL
      }
    }
  }
}
