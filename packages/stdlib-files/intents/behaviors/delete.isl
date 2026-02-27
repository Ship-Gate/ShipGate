// ============================================================================
// Delete Behaviors
// ============================================================================

behavior Delete {
  description: "Delete a file (soft delete)"
  
  actors {
    user: authenticated
  }
  
  input {
    file_id: FileId
    permanent: Boolean = false  // If true, skip trash
  }
  
  output {
    success: Boolean
    errors {
      FILE_NOT_FOUND {
        retriable: false
      }
      ACCESS_DENIED {
        when: "User doesn't have permission to delete this file"
        retriable: false
      }
      FILE_ALREADY_DELETED {
        when: "File is already deleted"
        retriable: false
      }
    }
  }
  
  preconditions {
    // File must exist
    File.exists(input.file_id)
    
    // File must not already be deleted
    File.lookup(input.file_id).status != DELETED
    
    // User must be owner
    File.lookup(input.file_id).owner_id == actor.id
  }
  
  postconditions {
    success implies {
      // Status updated to DELETED
      File.lookup(input.file_id).status == DELETED
      
      // Deletion timestamp set
      File.lookup(input.file_id).deleted_at != null
      File.lookup(input.file_id).deleted_at <= now()
      
      // Storage freed from quota
      actor.storage_used == old(actor.storage_used) - old(File.lookup(input.file_id).size)
    }
  }
  
  temporal {
    // Data must be purged within 24 hours for GDPR compliance
    eventually within 24.hours: storage_data_purged(input.file_id)
    
    // Response should be fast
    response within 200.ms (p99)
  }
  
  security {
    requires authentication
  }
  
  compliance {
    gdpr {
      must_support_deletion_request
      data_retention: 24.hours after deletion
    }
  }
  
  observability {
    metrics {
      files_deleted: counter { labels: [mime_type, permanent] }
      bytes_freed: counter { labels: [] }
    }
    logs {
      success: info { include: [file_id, name, size, permanent] }
      error: warn { include: [file_id, error_code] }
    }
  }
}

behavior BulkDelete {
  description: "Delete multiple files at once"
  
  actors {
    user: authenticated
  }
  
  input {
    file_ids: List<FileId> { max_length: 1000 }
    permanent: Boolean = false
  }
  
  output {
    success: BulkDeleteResult
    errors {
      EMPTY_LIST { when: "No file IDs provided" }
      PARTIAL_FAILURE { 
        when: "Some files could not be deleted"
        returns: BulkDeleteResult
      }
    }
  }
  
  preconditions {
    input.file_ids.length > 0
    input.file_ids.length <= 1000
  }
  
  postconditions {
    success implies {
      result.deleted_count + result.failed_count == input.file_ids.length
      all(result.deleted, id => File.lookup(id).status == DELETED)
    }
  }
  
  temporal {
    response within 2.seconds (p99)
  }
}

behavior Restore {
  description: "Restore a soft-deleted file"
  
  actors {
    user: authenticated
  }
  
  input {
    file_id: FileId
  }
  
  output {
    success: File
    errors {
      FILE_NOT_FOUND { }
      FILE_NOT_DELETED { when: "File is not in deleted state" }
      RESTORE_EXPIRED { when: "File is past the restore window" }
      QUOTA_EXCEEDED { when: "Restoring would exceed quota" }
      ACCESS_DENIED { }
    }
  }
  
  preconditions {
    File.exists(input.file_id)
    File.lookup(input.file_id).status == DELETED
    File.lookup(input.file_id).owner_id == actor.id
    // Must be within restore window (e.g., 30 days)
    File.lookup(input.file_id).deleted_at + config.restore_window > now()
    // Must have quota available
    actor.storage_used + File.lookup(input.file_id).size <= actor.storage_quota
  }
  
  postconditions {
    success implies {
      File.lookup(input.file_id).status == READY
      File.lookup(input.file_id).deleted_at == null
    }
  }
}

behavior PermanentDelete {
  description: "Permanently delete a file and its storage data"
  
  actors {
    admin: role(admin)
    system: internal
  }
  
  input {
    file_id: FileId
    reason: String?
  }
  
  output {
    success: Boolean
    errors {
      FILE_NOT_FOUND { }
      STORAGE_ERROR { when: "Failed to delete from storage" }
    }
  }
  
  preconditions {
    File.exists(input.file_id)
  }
  
  postconditions {
    success implies {
      not File.exists(input.file_id)
      // Storage data is purged (checked via storage API)
    }
  }
  
  temporal {
    // Storage cleanup should happen quickly
    response within 5.seconds (p99)
  }
  
  compliance {
    gdpr {
      this satisfies right_to_erasure
    }
    audit {
      log_reason: required
      log_actor: required
    }
  }
}

behavior EmptyTrash {
  description: "Permanently delete all files in user's trash"
  
  actors {
    user: authenticated
  }
  
  input {
    older_than: Duration?  // Only delete files deleted before this
  }
  
  output {
    success: { deleted_count: Int, freed_bytes: Int }
    errors {
      EMPTY_TRASH { when: "No deleted files found" }
    }
  }
  
  postconditions {
    success implies {
      result.deleted_count >= 0
      // All matching files permanently deleted
      count(File where owner_id == actor.id and status == DELETED and 
        (input.older_than == null or deleted_at < now() - input.older_than)) == 0
    }
  }
  
  temporal {
    response within 10.seconds (p99)
  }
}

// Supporting types
type BulkDeleteResult = {
  deleted: List<FileId>
  deleted_count: Int
  failed: List<{ file_id: FileId, error: String }>
  failed_count: Int
  total_bytes_freed: Int
}
