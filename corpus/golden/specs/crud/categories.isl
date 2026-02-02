// CRUD: Categories
domain CRUDCategories {
  version: "1.0.0"

  entity Category {
    id: UUID [immutable, unique]
    parent_id: UUID? [indexed]
    name: String
    slug: String [unique, indexed]
    description: String?
    image_url: String?
    sort_order: Int [default: 0]
    item_count: Int [default: 0]
    active: Boolean [default: true]
    path: String
    depth: Int
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      name.length > 0
      slug.length > 0
      item_count >= 0
      depth >= 0
      depth <= 5
    }
  }

  behavior CreateCategory {
    description: "Create a category"

    actors {
      Admin { must: authenticated }
    }

    input {
      name: String
      slug: String?
      description: String?
      parent_id: UUID?
      image_url: String?
      sort_order: Int?
    }

    output {
      success: Category

      errors {
        SLUG_EXISTS {
          when: "Slug already exists"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "Parent category not found"
          retriable: false
        }
        MAX_DEPTH_EXCEEDED {
          when: "Maximum nesting depth exceeded"
          retriable: false
        }
      }
    }

    pre {
      input.name.length > 0
      input.parent_id == null or Category.exists(input.parent_id)
      input.parent_id == null or Category.lookup(input.parent_id).depth < 5
    }

    post success {
      - Category.exists(result.id)
      - result.name == input.name
      - result.item_count == 0
    }
  }

  behavior GetCategory {
    description: "Get category"

    actors {
      Anonymous { }
    }

    input {
      id: UUID?
      slug: String?
    }

    output {
      success: Category

      errors {
        NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
      }
    }

    pre {
      input.id != null or input.slug != null
    }
  }

  behavior UpdateCategory {
    description: "Update a category"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
      name: String?
      slug: String?
      description: String?
      image_url: String?
      sort_order: Int?
      active: Boolean?
    }

    output {
      success: Category

      errors {
        NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
        SLUG_EXISTS {
          when: "Slug already exists"
          retriable: false
        }
      }
    }

    pre {
      Category.exists(input.id)
    }

    post success {
      - result.updated_at > old(Category.lookup(input.id).updated_at)
    }
  }

  behavior MoveCategory {
    description: "Move category to new parent"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
      new_parent_id: UUID?
    }

    output {
      success: Category

      errors {
        NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "Parent not found"
          retriable: false
        }
        CIRCULAR_REFERENCE {
          when: "Would create circular reference"
          retriable: false
        }
        MAX_DEPTH_EXCEEDED {
          when: "Would exceed max depth"
          retriable: false
        }
      }
    }

    pre {
      Category.exists(input.id)
      input.new_parent_id == null or Category.exists(input.new_parent_id)
      input.new_parent_id != input.id
    }

    post success {
      - result.parent_id == input.new_parent_id
    }
  }

  behavior DeleteCategory {
    description: "Delete a category"

    actors {
      Admin { must: authenticated }
    }

    input {
      id: UUID
      reassign_to: UUID?
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Category not found"
          retriable: false
        }
        HAS_CHILDREN {
          when: "Category has children"
          retriable: false
        }
        HAS_ITEMS {
          when: "Category has items"
          retriable: false
        }
      }
    }

    pre {
      Category.exists(input.id)
    }

    post success {
      - not Category.exists(input.id)
    }
  }

  behavior ListCategories {
    description: "List categories"

    actors {
      Anonymous { }
    }

    input {
      parent_id: UUID?
      active_only: Boolean?
      include_counts: Boolean?
    }

    output {
      success: List<Category>
    }

    post success {
      - input.active_only == true implies all(c in result: c.active == true)
    }
  }

  behavior GetCategoryTree {
    description: "Get category tree"

    actors {
      Anonymous { }
    }

    input {
      root_id: UUID?
      max_depth: Int?
    }

    output {
      success: List<{
        category: Category
        children: List<Category>
      }>
    }
  }

  scenarios CreateCategory {
    scenario "create root category" {
      when {
        result = CreateCategory(
          name: "Electronics",
          description: "Electronic products"
        )
      }

      then {
        result is success
        result.parent_id == null
        result.depth == 0
      }
    }

    scenario "create subcategory" {
      given {
        parent = Category.create(name: "Electronics")
      }

      when {
        result = CreateCategory(
          name: "Phones",
          parent_id: parent.id
        )
      }

      then {
        result is success
        result.parent_id == parent.id
        result.depth == 1
      }
    }
  }
}
