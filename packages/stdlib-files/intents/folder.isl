// ============================================================================
// Folder Entity Definition
// ============================================================================

entity Folder {
  // ============================================================================
  // FIELDS
  // ============================================================================
  
  id: FolderId [immutable, unique, indexed]
  
  // Basic info
  name: String { 
    max_length: 255
    pattern: /^[^<>:"/\\|?*\x00-\x1f]+$/
  }
  path: FilePath [unique, indexed]
  
  // Hierarchy
  parent_id: FolderId? [indexed]
  depth: Int { min: 0, max: 50 }  // Max nesting depth
  
  // Ownership
  owner_id: UUID [immutable, indexed]
  
  // Access control
  access_level: AccessLevel = PRIVATE
  shared_with: List<UUID> = []
  inherit_permissions: Boolean = true
  
  // Metadata
  metadata: Map<String, String> = {}
  
  // Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants {
    // Name cannot be empty
    name.length > 0
    
    // Root folders have no parent
    parent_id == null implies depth == 0
    
    // Depth must match hierarchy
    parent_id != null implies depth == Folder.lookup(parent_id).depth + 1
    
    // Cannot be own parent
    parent_id != id
    
    // Path must start with /
    path.starts_with("/")
  }
  
  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  computed {
    is_root: Boolean = parent_id == null
    
    file_count: Int = count(File where folder_id == id and status != DELETED)
    
    subfolder_count: Int = count(Folder where parent_id == id)
    
    total_size: FileSize = sum(File.size where folder_id == id and status != DELETED)
    
    full_path: String = parent_id != null
      ? Folder.lookup(parent_id).full_path + "/" + name
      : "/" + name
    
    ancestors: List<Folder> = parent_id != null
      ? [Folder.lookup(parent_id)] + Folder.lookup(parent_id).ancestors
      : []
    
    effective_access_level: AccessLevel = 
      inherit_permissions and parent_id != null
        ? Folder.lookup(parent_id).effective_access_level
        : access_level
  }
  
  // ============================================================================
  // METHODS
  // ============================================================================
  
  methods {
    is_ancestor_of(folder: Folder): Boolean {
      if (folder.parent_id == null) {
        return false
      }
      if (folder.parent_id == id) {
        return true
      }
      return is_ancestor_of(Folder.lookup(folder.parent_id))
    }
    
    can_access(user_id: UUID): Boolean {
      if (owner_id == user_id) return true
      if (effective_access_level == PUBLIC) return true
      if (effective_access_level == SHARED and user_id in shared_with) return true
      if (inherit_permissions and parent_id != null) {
        return Folder.lookup(parent_id).can_access(user_id)
      }
      return false
    }
    
    get_all_files(): List<File> {
      return File.find_all(folder_id == id and status != DELETED)
    }
    
    get_subfolders(): List<Folder> {
      return Folder.find_all(parent_id == id)
    }
  }
}

// ============================================================================
// FOLDER BEHAVIORS
// ============================================================================

behavior CreateFolder {
  description: "Create a new folder"
  
  input {
    name: String { max_length: 255 }
    parent_id: FolderId?
  }
  
  output {
    success: Folder
    errors {
      PARENT_NOT_FOUND { when: "Parent folder does not exist" }
      FOLDER_EXISTS { when: "Folder with same name exists in parent" }
      MAX_DEPTH_EXCEEDED { when: "Maximum folder nesting depth exceeded" }
      INVALID_NAME { when: "Folder name contains invalid characters" }
    }
  }
  
  preconditions {
    input.parent_id != null implies Folder.exists(input.parent_id)
    input.parent_id != null implies Folder.lookup(input.parent_id).depth < 50
  }
  
  postconditions {
    success implies {
      Folder.exists(result.id)
      result.name == input.name
      result.parent_id == input.parent_id
    }
  }
  
  security {
    requires authentication
  }
}

behavior RenameFolder {
  description: "Rename an existing folder"
  
  input {
    folder_id: FolderId
    new_name: String { max_length: 255 }
  }
  
  output {
    success: Folder
    errors {
      FOLDER_NOT_FOUND { }
      ACCESS_DENIED { }
      FOLDER_EXISTS { when: "Folder with new name exists in parent" }
    }
  }
  
  postconditions {
    success implies {
      Folder.lookup(input.folder_id).name == input.new_name
    }
  }
}

behavior MoveFolder {
  description: "Move folder to new parent"
  
  input {
    folder_id: FolderId
    new_parent_id: FolderId?
  }
  
  output {
    success: Folder
    errors {
      FOLDER_NOT_FOUND { }
      PARENT_NOT_FOUND { }
      ACCESS_DENIED { }
      CIRCULAR_REFERENCE { when: "Cannot move folder into its own subtree" }
      MAX_DEPTH_EXCEEDED { }
    }
  }
  
  preconditions {
    Folder.exists(input.folder_id)
    input.new_parent_id != null implies Folder.exists(input.new_parent_id)
    // Cannot move to own subtree
    input.new_parent_id != null implies not Folder.lookup(input.folder_id).is_ancestor_of(Folder.lookup(input.new_parent_id))
  }
  
  postconditions {
    success implies {
      Folder.lookup(input.folder_id).parent_id == input.new_parent_id
    }
  }
}

behavior DeleteFolder {
  description: "Delete a folder and optionally its contents"
  
  input {
    folder_id: FolderId
    recursive: Boolean = false
  }
  
  output {
    success: { deleted_files: Int, deleted_folders: Int }
    errors {
      FOLDER_NOT_FOUND { }
      ACCESS_DENIED { }
      FOLDER_NOT_EMPTY { when: "Folder has contents and recursive=false" }
    }
  }
  
  preconditions {
    Folder.exists(input.folder_id)
    not input.recursive implies Folder.lookup(input.folder_id).file_count == 0
    not input.recursive implies Folder.lookup(input.folder_id).subfolder_count == 0
  }
  
  postconditions {
    success implies {
      not Folder.exists(input.folder_id)
    }
  }
}
