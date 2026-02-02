// Uploads: Generic attachment system
domain UploadsAttachment {
  version: "1.0.0"

  enum AttachmentType {
    IMAGE
    DOCUMENT
    VIDEO
    AUDIO
    ARCHIVE
    OTHER
  }

  type AttachableRef = {
    type: String
    id: UUID
  }

  entity Attachment {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    attachable: AttachableRef [indexed]
    name: String
    original_name: String
    type: AttachmentType
    mime_type: String
    size: Int
    url: String
    thumbnail_url: String?
    metadata: Map<String, String>
    position: Int?
    created_at: Timestamp [immutable]

    invariants {
      size > 0
      name.length > 0
    }
  }

  behavior AttachFile {
    description: "Attach file to an entity"

    actors {
      User { must: authenticated }
    }

    input {
      file: Binary
      attachable_type: String
      attachable_id: UUID
      name: String?
      position: Int?
      metadata: Map<String, String>?
    }

    output {
      success: Attachment

      errors {
        ATTACHABLE_NOT_FOUND {
          when: "Entity to attach to not found"
          retriable: false
        }
        FILE_TOO_LARGE {
          when: "File exceeds size limit"
          retriable: false
        }
        MAX_ATTACHMENTS_REACHED {
          when: "Maximum attachments reached"
          retriable: false
        }
        INVALID_FILE_TYPE {
          when: "File type not allowed"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to attach"
          retriable: false
        }
      }
    }

    pre {
      input.file.size > 0
      input.file.size <= 50.megabytes
    }

    post success {
      - Attachment.exists(result.id)
      - result.attachable.type == input.attachable_type
      - result.attachable.id == input.attachable_id
    }
  }

  behavior ListAttachments {
    description: "List attachments for entity"

    actors {
      User { must: authenticated }
      Anonymous { }
    }

    input {
      attachable_type: String
      attachable_id: UUID
      type_filter: AttachmentType?
    }

    output {
      success: List<Attachment>

      errors {
        ATTACHABLE_NOT_FOUND {
          when: "Entity not found"
          retriable: false
        }
      }
    }

    post success {
      - all(a in result: a.attachable.type == input.attachable_type and a.attachable.id == input.attachable_id)
    }
  }

  behavior ReorderAttachments {
    description: "Reorder attachments"

    actors {
      User { must: authenticated }
    }

    input {
      attachable_type: String
      attachable_id: UUID
      attachment_ids: List<UUID>
    }

    output {
      success: List<Attachment>

      errors {
        ATTACHABLE_NOT_FOUND {
          when: "Entity not found"
          retriable: false
        }
        ATTACHMENT_NOT_FOUND {
          when: "Attachment not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    post success {
      - result.length == input.attachment_ids.length
    }
  }

  behavior DeleteAttachment {
    description: "Delete an attachment"

    actors {
      User { must: authenticated }
    }

    input {
      attachment_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Attachment not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Attachment.exists(input.attachment_id)
    }

    post success {
      - not Attachment.exists(input.attachment_id)
    }
  }

  behavior CopyAttachment {
    description: "Copy attachment to another entity"

    actors {
      User { must: authenticated }
    }

    input {
      attachment_id: UUID
      target_type: String
      target_id: UUID
    }

    output {
      success: Attachment

      errors {
        ATTACHMENT_NOT_FOUND {
          when: "Attachment not found"
          retriable: false
        }
        TARGET_NOT_FOUND {
          when: "Target entity not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Attachment.exists(input.attachment_id)
    }

    post success {
      - Attachment.exists(result.id)
      - result.id != input.attachment_id
      - result.attachable.type == input.target_type
      - result.attachable.id == input.target_id
    }
  }

  scenarios AttachFile {
    scenario "attach image to post" {
      when {
        result = AttachFile(
          file: Binary { mime_type: "image/jpeg", size: 500.kilobytes },
          attachable_type: "Post",
          attachable_id: "post-123"
        )
      }

      then {
        result is success
        result.type == IMAGE
        result.thumbnail_url != null
      }
    }

    scenario "attach document to comment" {
      when {
        result = AttachFile(
          file: Binary { mime_type: "application/pdf", size: 2.megabytes },
          attachable_type: "Comment",
          attachable_id: "comment-456",
          name: "Report.pdf"
        )
      }

      then {
        result is success
        result.type == DOCUMENT
      }
    }
  }
}
