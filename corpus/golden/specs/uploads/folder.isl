// Uploads: Folder/directory management
domain UploadsFolder {
  version: "1.0.0"

  entity Folder {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    parent_id: UUID? [indexed]
    name: String
    path: String [indexed]
    file_count: Int [default: 0]
    folder_count: Int [default: 0]
    total_size: Int [default: 0]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      name.length > 0
      file_count >= 0
      folder_count >= 0
      total_size >= 0
    }
  }

  behavior CreateFolder {
    description: "Create a folder"

    actors {
      User { must: authenticated }
    }

    input {
      name: String
      parent_id: UUID?
    }

    output {
      success: Folder

      errors {
        PARENT_NOT_FOUND {
          when: "Parent folder not found"
          retriable: false
        }
        FOLDER_EXISTS {
          when: "Folder already exists"
          retriable: false
        }
        INVALID_NAME {
          when: "Folder name is invalid"
          retriable: true
        }
        DEPTH_LIMIT_EXCEEDED {
          when: "Maximum folder depth exceeded"
          retriable: false
        }
      }
    }

    pre {
      input.name.length > 0
      input.name not contains "/"
      input.parent_id == null or Folder.exists(input.parent_id)
    }

    post success {
      - Folder.exists(result.id)
      - result.name == input.name
      - result.file_count == 0
      - result.folder_count == 0
    }
  }

  behavior GetFolder {
    description: "Get folder details"

    actors {
      User { must: authenticated }
    }

    input {
      folder_id: UUID?
      path: String?
    }

    output {
      success: Folder

      errors {
        NOT_FOUND {
          when: "Folder not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      input.folder_id != null or input.path != null
    }
  }

  behavior ListFolderContents {
    description: "List contents of a folder"

    actors {
      User { must: authenticated }
    }

    input {
      folder_id: UUID?
      path: String?
      include_files: Boolean?
      include_folders: Boolean?
      sort_by: String?
      sort_order: String?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        folder: Folder
        files: List<{ id: UUID, name: String, size: Int, mime_type: String, created_at: Timestamp }>
        folders: List<Folder>
        total_count: Int
        has_more: Boolean
      }
    }

    post success {
      - input.include_files == false implies result.files.length == 0
      - input.include_folders == false implies result.folders.length == 0
    }
  }

  behavior RenameFolder {
    description: "Rename a folder"

    actors {
      User { must: authenticated }
    }

    input {
      folder_id: UUID
      new_name: String
    }

    output {
      success: Folder

      errors {
        NOT_FOUND {
          when: "Folder not found"
          retriable: false
        }
        NAME_EXISTS {
          when: "Folder with name exists"
          retriable: false
        }
        INVALID_NAME {
          when: "Invalid folder name"
          retriable: true
        }
      }
    }

    pre {
      Folder.exists(input.folder_id)
      input.new_name.length > 0
      input.new_name not contains "/"
    }

    post success {
      - result.name == input.new_name
    }
  }

  behavior MoveFolder {
    description: "Move folder to new parent"

    actors {
      User { must: authenticated }
    }

    input {
      folder_id: UUID
      new_parent_id: UUID?
    }

    output {
      success: Folder

      errors {
        NOT_FOUND {
          when: "Folder not found"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "New parent not found"
          retriable: false
        }
        CIRCULAR_REFERENCE {
          when: "Would create circular reference"
          retriable: false
        }
        NAME_EXISTS {
          when: "Folder exists in destination"
          retriable: false
        }
      }
    }

    pre {
      Folder.exists(input.folder_id)
      input.new_parent_id == null or Folder.exists(input.new_parent_id)
      input.new_parent_id != input.folder_id
    }

    post success {
      - result.parent_id == input.new_parent_id
    }
  }

  behavior DeleteFolder {
    description: "Delete a folder"

    actors {
      User { must: authenticated }
    }

    input {
      folder_id: UUID
      recursive: Boolean?
    }

    output {
      success: {
        deleted_folders: Int
        deleted_files: Int
        freed_bytes: Int
      }

      errors {
        NOT_FOUND {
          when: "Folder not found"
          retriable: false
        }
        NOT_EMPTY {
          when: "Folder is not empty"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Folder.exists(input.folder_id)
      input.recursive == true or (Folder.lookup(input.folder_id).file_count == 0 and Folder.lookup(input.folder_id).folder_count == 0)
    }

    post success {
      - not Folder.exists(input.folder_id)
    }
  }

  scenarios CreateFolder {
    scenario "create root folder" {
      when {
        result = CreateFolder(name: "Documents")
      }

      then {
        result is success
        result.parent_id == null
        result.path == "/Documents"
      }
    }

    scenario "create nested folder" {
      given {
        parent = Folder.create(name: "Documents")
      }

      when {
        result = CreateFolder(name: "Work", parent_id: parent.id)
      }

      then {
        result is success
        result.parent_id == parent.id
      }
    }
  }
}
