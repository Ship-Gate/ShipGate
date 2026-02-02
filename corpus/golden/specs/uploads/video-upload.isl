// Uploads: Video upload with transcoding
domain UploadsVideo {
  version: "1.0.0"

  enum VideoStatus {
    UPLOADING
    QUEUED
    PROCESSING
    READY
    FAILED
  }

  enum VideoQuality {
    SD_480
    HD_720
    HD_1080
    UHD_4K
  }

  type VideoRendition = {
    quality: VideoQuality
    width: Int
    height: Int
    bitrate: Int
    codec: String
    url: String
    size: Int
  }

  entity Video {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    title: String
    original_name: String
    mime_type: String
    size: Int
    duration: Decimal?
    width: Int?
    height: Int?
    status: VideoStatus
    renditions: List<VideoRendition>
    thumbnail_url: String?
    preview_url: String?
    hls_url: String?
    dash_url: String?
    storage_path: String [secret]
    processing_progress: Int?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      size > 0
      duration == null or duration > 0
    }

    lifecycle {
      UPLOADING -> QUEUED
      QUEUED -> PROCESSING
      PROCESSING -> READY
      PROCESSING -> FAILED
    }
  }

  behavior UploadVideo {
    description: "Upload a video"

    actors {
      User { must: authenticated }
    }

    input {
      file: Binary
      title: String
      generate_thumbnail: Boolean?
      generate_preview: Boolean?
      target_qualities: List<VideoQuality>?
      metadata: Map<String, String>?
    }

    output {
      success: Video

      errors {
        NOT_A_VIDEO {
          when: "File is not a valid video"
          retriable: false
        }
        VIDEO_TOO_LARGE {
          when: "Video exceeds size limit"
          retriable: false
        }
        UNSUPPORTED_FORMAT {
          when: "Video format not supported"
          retriable: false
        }
        STORAGE_QUOTA_EXCEEDED {
          when: "Storage quota exceeded"
          retriable: false
        }
      }
    }

    pre {
      input.file.size > 0
      input.file.size <= 10.gigabytes
      input.title.length > 0
    }

    post success {
      - Video.exists(result.id)
      - result.status == QUEUED or result.status == PROCESSING
    }

    temporal {
      - within 60s (p99): upload complete
      - eventually within 30m: transcoding complete
    }
  }

  behavior GetVideo {
    description: "Get video details"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      video_id: UUID
    }

    output {
      success: Video

      errors {
        NOT_FOUND {
          when: "Video not found"
          retriable: false
        }
      }
    }

    pre {
      Video.exists(input.video_id)
    }
  }

  behavior GetPlaybackUrl {
    description: "Get video playback URL"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      video_id: UUID
      quality: VideoQuality?
      format: String?
    }

    output {
      success: {
        url: String
        quality: VideoQuality
        expires_at: Timestamp?
      }

      errors {
        NOT_FOUND {
          when: "Video not found"
          retriable: false
        }
        NOT_READY {
          when: "Video not ready"
          retriable: true
        }
        QUALITY_NOT_AVAILABLE {
          when: "Quality not available"
          retriable: false
        }
      }
    }

    pre {
      Video.exists(input.video_id)
      Video.lookup(input.video_id).status == READY
    }
  }

  behavior GetProcessingStatus {
    description: "Get video processing status"

    actors {
      User { must: authenticated }
    }

    input {
      video_id: UUID
    }

    output {
      success: {
        status: VideoStatus
        progress: Int?
        estimated_time_remaining: Duration?
        renditions_complete: List<VideoQuality>
      }

      errors {
        NOT_FOUND {
          when: "Video not found"
          retriable: false
        }
      }
    }

    pre {
      Video.exists(input.video_id)
    }
  }

  behavior DeleteVideo {
    description: "Delete a video"

    actors {
      User { must: authenticated }
    }

    input {
      video_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Video not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Video.exists(input.video_id)
      Video.lookup(input.video_id).owner_id == actor.id
    }

    post success {
      - not Video.exists(input.video_id)
    }

    temporal {
      - eventually within 24h: all renditions deleted
    }
  }

  scenarios UploadVideo {
    scenario "upload with transcoding" {
      when {
        result = UploadVideo(
          file: Binary { mime_type: "video/mp4", size: 500.megabytes },
          title: "My Video",
          target_qualities: [HD_720, HD_1080],
          generate_thumbnail: true
        )
      }

      then {
        result is success
        result.status == QUEUED or result.status == PROCESSING
      }
    }
  }
}
