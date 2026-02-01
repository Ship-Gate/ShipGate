// ============================================================================
// Files Domain - File Storage Standard Library
// Version: 1.0.0
// ============================================================================

domain Files {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // Import behaviors
  import { Upload, CompleteUpload } from "./behaviors/upload.isl"
  import { Download, GetDownloadUrl } from "./behaviors/download.isl"
  import { Delete, BulkDelete } from "./behaviors/delete.isl"
  import { CreatePresignedUrl } from "./behaviors/presign.isl"
  
  // Import entities
  import { File } from "./file.isl"
  import { Folder } from "./folder.isl"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type FileId = UUID
  type FolderId = UUID
  type FilePath = String { 
    pattern: /^[a-zA-Z0-9\/_.-]+$/
    max_length: 1024 
  }
  type MimeType = String { 
    pattern: /^[a-z]+\/[a-z0-9.+-]+$/ 
  }
  type FileSize = Int { 
    min: 0
    max: 5368709120  // 5GB max
  }
  type StorageQuota = Int {
    min: 0
    max: 107374182400  // 100GB max
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum FileStatus {
    UPLOADING    // File upload in progress
    READY        // File is available
    PROCESSING   // File being processed (e.g., virus scan, thumbnail)
    DELETED      // File marked for deletion
  }
  
  enum StorageProvider {
    S3
    GCS
    AZURE_BLOB
    LOCAL
  }
  
  enum AccessLevel {
    PRIVATE      // Only owner can access
    SHARED       // Specific users can access
    PUBLIC       // Anyone with link can access
  }
  
  // ============================================================================
  // VALUE TYPES
  // ============================================================================
  
  type UploadResult = {
    file: File
    upload_url: String
    expires_at: Timestamp
  }
  
  type DownloadResult = {
    file: File
    download_url: String
    expires_at: Timestamp
  }
  
  type FileMetadata = {
    content_type: MimeType
    content_length: FileSize
    checksum: String
    etag: String?
    last_modified: Timestamp
    custom: Map<String, String>
  }
  
  type StorageStats = {
    total_files: Int
    total_size: FileSize
    quota_used_percent: Decimal
  }
  
  // ============================================================================
  // GLOBAL INVARIANTS
  // ============================================================================
  
  invariants StorageQuota {
    description: "Users cannot exceed their storage quota"
    scope: global
    
    always {
      all(User, u => 
        sum(File.size where owner_id == u.id and status != DELETED) <= u.storage_quota
      )
    }
  }
  
  invariants FilePathUniqueness {
    description: "File paths must be unique within a folder"
    scope: global
    
    always {
      all(File, f1 => all(File, f2 =>
        (f1.id != f2.id and f1.folder_id == f2.folder_id) implies f1.path != f2.path
      ))
    }
  }
  
  invariants FolderHierarchy {
    description: "Folders cannot be their own ancestor"
    scope: global
    
    always {
      all(Folder, f => not f.is_ancestor_of(f))
    }
  }
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  policy FileAccess {
    applies_to: [Download, Delete]
    
    rules {
      // Owner always has access
      actor.id == target.owner_id implies allow
      
      // Shared files accessible to shared users
      target.access_level == SHARED and actor.id in target.shared_with implies allow
      
      // Public files accessible to anyone
      target.access_level == PUBLIC implies allow
      
      // Default deny
      deny
    }
  }
  
  policy UploadLimits {
    applies_to: [Upload]
    
    rules {
      // Check file size limit
      input.size > config.max_file_size implies {
        reject with FILE_TOO_LARGE
      }
      
      // Check MIME type allowlist
      input.mime_type not in config.allowed_mime_types implies {
        reject with INVALID_MIME_TYPE
      }
      
      // Check quota
      actor.storage_used + input.size > actor.storage_quota implies {
        reject with QUOTA_EXCEEDED
      }
    }
  }
}
