// CRUD: Tag management
domain CRUDTags {
  version: "1.0.0"

  entity Tag {
    id: UUID [immutable, unique]
    name: String [unique]
    slug: String [unique, indexed]
    description: String?
    color: String?
    usage_count: Int [default: 0]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      name.length > 0
      slug.length > 0
      usage_count >= 0
    }
  }

  entity Tagging {
    id: UUID [immutable, unique]
    tag_id: UUID [indexed]
    taggable_type: String [indexed]
    taggable_id: UUID [indexed]
    created_at: Timestamp [immutable]
  }

  behavior CreateTag {
    description: "Create a tag"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      name: String
      description: String?
      color: String?
    }

    output {
      success: Tag

      errors {
        NAME_EXISTS {
          when: "Tag already exists"
          retriable: false
        }
        INVALID_NAME {
          when: "Tag name is invalid"
          retriable: true
        }
        INVALID_COLOR {
          when: "Color format invalid"
          retriable: true
        }
      }
    }

    pre {
      input.name.length > 0
      input.name.length <= 50
      not Tag.exists(name: input.name)
    }

    post success {
      - Tag.exists(result.id)
      - result.usage_count == 0
    }
  }

  behavior GetTag {
    description: "Get tag by ID or slug"

    actors {
      Anonymous { }
    }

    input {
      id: UUID?
      slug: String?
      name: String?
    }

    output {
      success: Tag

      errors {
        NOT_FOUND {
          when: "Tag not found"
          retriable: false
        }
      }
    }

    pre {
      input.id != null or input.slug != null or input.name != null
    }
  }

  behavior UpdateTag {
    description: "Update a tag"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
      name: String?
      description: String?
      color: String?
    }

    output {
      success: Tag

      errors {
        NOT_FOUND {
          when: "Tag not found"
          retriable: false
        }
        NAME_EXISTS {
          when: "Name already taken"
          retriable: false
        }
      }
    }

    pre {
      Tag.exists(input.id)
    }

    post success {
      - result.updated_at > old(Tag.lookup(input.id).updated_at)
    }
  }

  behavior DeleteTag {
    description: "Delete a tag"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Tag not found"
          retriable: false
        }
      }
    }

    pre {
      Tag.exists(input.id)
    }

    post success {
      - not Tag.exists(input.id)
      - not Tagging.exists(tag_id: input.id)
    }
  }

  behavior TagItem {
    description: "Add tag to item"

    actors {
      User { must: authenticated }
    }

    input {
      tag_id: UUID?
      tag_name: String?
      taggable_type: String
      taggable_id: UUID
    }

    output {
      success: Tagging

      errors {
        TAG_NOT_FOUND {
          when: "Tag not found"
          retriable: false
        }
        ALREADY_TAGGED {
          when: "Item already has this tag"
          retriable: false
        }
        MAX_TAGS_REACHED {
          when: "Maximum tags reached"
          retriable: false
        }
      }
    }

    pre {
      input.tag_id != null or input.tag_name != null
    }

    post success {
      - Tagging.exists(result.id)
      - Tag.lookup(input.tag_id or Tag.lookup(name: input.tag_name).id).usage_count == old(usage_count) + 1
    }
  }

  behavior UntagItem {
    description: "Remove tag from item"

    actors {
      User { must: authenticated }
    }

    input {
      tag_id: UUID
      taggable_type: String
      taggable_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_TAGGED {
          when: "Item does not have this tag"
          retriable: false
        }
      }
    }

    post success {
      - not Tagging.exists(tag_id: input.tag_id, taggable_type: input.taggable_type, taggable_id: input.taggable_id)
    }
  }

  behavior ListTags {
    description: "List tags"

    actors {
      Anonymous { }
    }

    input {
      search: String?
      min_usage: Int?
      limit: Int?
      sort_by: String?
    }

    output {
      success: List<Tag>
    }

    post success {
      - input.min_usage != null implies all(t in result: t.usage_count >= input.min_usage)
    }
  }

  behavior GetPopularTags {
    description: "Get most used tags"

    actors {
      Anonymous { }
    }

    input {
      limit: Int?
      taggable_type: String?
    }

    output {
      success: List<Tag>
    }

    pre {
      input.limit == null or (input.limit >= 1 and input.limit <= 100)
    }
  }

  scenarios CreateTag {
    scenario "create with color" {
      when {
        result = CreateTag(
          name: "featured",
          description: "Featured content",
          color: "#FF5733"
        )
      }

      then {
        result is success
        result.color == "#FF5733"
      }
    }
  }
}
