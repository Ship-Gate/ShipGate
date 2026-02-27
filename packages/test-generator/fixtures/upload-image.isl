// Upload domain fixture: Image upload with processing
domain Media {
  version: "1.0.0"
  
  entity Image {
    id: UUID [immutable]
    url: String
    thumbnail_url: String?
    width: Int
    height: Int
    format: String
  }
  
  behavior UploadImage {
    description: "Upload and process an image"
    
    input {
      filename: String
      content_type: String
      file: {
        size: Int
        data: String
      }
      resize_to: {
        width: Int?
        height: Int?
      }?
    }
    
    output {
      success: {
        id: UUID
        url: String
        thumbnail_url: String?
        width: Int
        height: Int
      }
      
      errors {
        INVALID_FILE_TYPE {
          when: "Not a valid image format"
          retriable: false
        }
        FILE_TOO_LARGE {
          when: "Image exceeds size limit"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "Image processing failed"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.content_type in ["image/jpeg", "image/png", "image/webp", "image/gif"]
      input.file.size > 0
      input.file.size <= 20971520
    }
    
    postconditions {
      success implies {
        Image.exists(result.id)
        result.url != null
        result.width > 0
        result.height > 0
      }
    }
  }
}
