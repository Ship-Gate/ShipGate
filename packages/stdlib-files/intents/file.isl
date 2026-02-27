// ============================================================================
// File Entity Definition
// ============================================================================

entity File {
  // ============================================================================
  // FIELDS
  // ============================================================================
  
  id: FileId [immutable, unique, indexed]
  
  // Basic info
  name: String { 
    max_length: 255 
    pattern: /^[^<>:"/\\|?*\x00-\x1f]+$/  // No invalid filename chars
  }
  path: FilePath [unique, indexed]
  
  // Content info
  mime_type: MimeType
  size: FileSize
  checksum: String [immutable]  // SHA-256 hash
  
  // Status
  status: FileStatus
  
  // Ownership & organization
  owner_id: UUID [immutable, indexed]
  folder_id: FolderId? [indexed]
  
  // Access control
  access_level: AccessLevel = PRIVATE
  shared_with: List<UUID> = []
  
  // Storage details
  storage_provider: StorageProvider
  storage_key: String [immutable]  // Internal storage path/key
  storage_bucket: String [immutable]
  
  // Metadata
  metadata: Map<String, String> = {}
  
  // Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  deleted_at: Timestamp?
  expires_at: Timestamp?  // Optional auto-expiration
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants {
    // Deleted files must have deleted_at timestamp
    deleted_at != null implies status == DELETED
    
    // Size must be non-negative
    size >= 0
    
    // Ready files must have checksum
    status == READY implies checksum != null
    
    // Storage key must be set
    storage_key != null and storage_key.length > 0
    
    // Name cannot be empty
    name.length > 0
    
    // Expiration must be in the future when set
    expires_at != null implies expires_at > created_at
  }
  
  // ============================================================================
  // LIFECYCLE
  // ============================================================================
  
  lifecycle {
    // Initial upload
    UPLOADING -> READY: when upload_complete
    UPLOADING -> DELETED: when upload_cancelled or upload_expired
    
    // Processing transitions
    READY -> PROCESSING: when processing_started
    PROCESSING -> READY: when processing_complete
    PROCESSING -> DELETED: when processing_failed and config.delete_on_failure
    
    // Deletion
    READY -> DELETED: when delete_requested
  }
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  computed {
    extension: String = name.split('.').last() ?? ""
    
    is_image: Boolean = mime_type.starts_with("image/")
    is_video: Boolean = mime_type.starts_with("video/")
    is_audio: Boolean = mime_type.starts_with("audio/")
    is_document: Boolean = mime_type in [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ]
    
    is_expired: Boolean = expires_at != null and expires_at < now()
    is_deleted: Boolean = status == DELETED
    is_available: Boolean = status == READY and not is_expired
    
    full_path: String = folder_id != null 
      ? Folder.lookup(folder_id).path + "/" + name 
      : "/" + name
  }
  
  // ============================================================================
  // METHODS
  // ============================================================================
  
  methods {
    can_access(user_id: UUID): Boolean {
      return owner_id == user_id 
        or access_level == PUBLIC 
        or (access_level == SHARED and user_id in shared_with)
    }
    
    is_owned_by(user_id: UUID): Boolean {
      return owner_id == user_id
    }
  }
}
