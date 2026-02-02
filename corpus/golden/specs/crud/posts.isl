// CRUD: Blog posts
domain CRUDPosts {
  version: "1.0.0"

  enum PostStatus {
    DRAFT
    PUBLISHED
    ARCHIVED
  }

  enum Visibility {
    PUBLIC
    PRIVATE
    UNLISTED
  }

  entity Post {
    id: UUID [immutable, unique]
    author_id: UUID [indexed]
    slug: String [unique, indexed]
    title: String
    excerpt: String?
    content: String
    status: PostStatus [default: DRAFT]
    visibility: Visibility [default: PUBLIC]
    featured_image: String?
    tags: List<String>
    view_count: Int [default: 0]
    like_count: Int [default: 0]
    comment_count: Int [default: 0]
    published_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      title.length > 0
      content.length > 0
      view_count >= 0
      like_count >= 0
      comment_count >= 0
      status == PUBLISHED implies published_at != null
    }

    lifecycle {
      DRAFT -> PUBLISHED
      PUBLISHED -> ARCHIVED
      ARCHIVED -> PUBLISHED
      PUBLISHED -> DRAFT
    }
  }

  behavior CreatePost {
    description: "Create a new post"

    actors {
      User { must: authenticated }
    }

    input {
      title: String
      content: String
      excerpt: String?
      slug: String?
      visibility: Visibility?
      featured_image: String?
      tags: List<String>?
      publish: Boolean?
    }

    output {
      success: Post

      errors {
        SLUG_EXISTS {
          when: "Slug already taken"
          retriable: false
        }
        CONTENT_TOO_SHORT {
          when: "Content is too short"
          retriable: true
        }
      }
    }

    pre {
      input.title.length > 0
      input.content.length > 0
      input.slug == null or not Post.exists(slug: input.slug)
    }

    post success {
      - Post.exists(result.id)
      - result.author_id == actor.id
      - input.publish == true implies result.status == PUBLISHED
      - input.publish != true implies result.status == DRAFT
    }
  }

  behavior GetPost {
    description: "Get post by ID or slug"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      id: UUID?
      slug: String?
    }

    output {
      success: Post

      errors {
        NOT_FOUND {
          when: "Post not found"
          retriable: false
        }
        ACCESS_DENIED {
          when: "Not authorized to view"
          retriable: false
        }
      }
    }

    pre {
      input.id != null or input.slug != null
    }

    post success {
      - Post.lookup(result.id).view_count >= old(Post.lookup(result.id).view_count)
    }
  }

  behavior UpdatePost {
    description: "Update a post"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      id: UUID
      title: String?
      content: String?
      excerpt: String?
      slug: String?
      visibility: Visibility?
      featured_image: String?
      tags: List<String>?
    }

    output {
      success: Post

      errors {
        NOT_FOUND {
          when: "Post not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
        SLUG_EXISTS {
          when: "Slug already taken"
          retriable: false
        }
      }
    }

    pre {
      Post.exists(input.id)
      Post.lookup(input.id).author_id == actor.id or actor.role == ADMIN
    }

    post success {
      - result.updated_at > old(Post.lookup(input.id).updated_at)
    }
  }

  behavior PublishPost {
    description: "Publish a draft post"

    actors {
      User { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Post

      errors {
        NOT_FOUND {
          when: "Post not found"
          retriable: false
        }
        ALREADY_PUBLISHED {
          when: "Post already published"
          retriable: false
        }
      }
    }

    pre {
      Post.exists(input.id)
      Post.lookup(input.id).status == DRAFT
    }

    post success {
      - result.status == PUBLISHED
      - result.published_at != null
    }
  }

  behavior DeletePost {
    description: "Delete a post"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Post not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Post.exists(input.id)
    }

    post success {
      - not Post.exists(input.id)
    }
  }

  behavior ListPosts {
    description: "List posts"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      author_id: UUID?
      status: PostStatus?
      tag: String?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        posts: List<Post>
        total_count: Int
        has_more: Boolean
      }
    }
  }

  scenarios CreatePost {
    scenario "create and publish" {
      when {
        result = CreatePost(
          title: "My First Post",
          content: "This is the content of my first post.",
          publish: true
        )
      }

      then {
        result is success
        result.status == PUBLISHED
      }
    }
  }
}
