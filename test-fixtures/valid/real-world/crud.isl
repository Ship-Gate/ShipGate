// Real-world CRUD operations domain
// Realistic spec for basic resource management

domain CRUD {
  version: "1.0.0"
  owner: "Platform Team"
  
  // === TYPES ===
  
  type Slug = String {
    min_length: 1
    max_length: 100
    pattern: "^[a-z0-9-]+$"
  }
  
  type SortOrder = String {
    pattern: "^(asc|desc)$"
  }
  
  enum Visibility {
    PRIVATE
    INTERNAL
    PUBLIC
  }
  
  type Pagination = {
    page: Int
    page_size: Int
    total_count: Int
    total_pages: Int
    has_next: Boolean
    has_previous: Boolean
  }
  
  type SortOptions = {
    field: String
    order: String
  }
  
  type FilterOptions = {
    field: String
    operator: String
    value: String
  }
  
  // === ENTITIES ===
  
  entity Post {
    id: UUID [immutable, unique]
    slug: String [unique, indexed]
    author_id: UUID [indexed]
    
    title: String
    content: String
    excerpt: String?
    
    visibility: Visibility
    published: Boolean
    published_at: Timestamp?
    
    tags: List<String>
    categories: List<UUID>
    
    featured_image: String?
    metadata: Map<String, String>
    
    view_count: Int
    like_count: Int
    comment_count: Int
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      title.length > 0
      slug.length > 0
      view_count >= 0
      like_count >= 0
      comment_count >= 0
      published implies published_at != null
    }
    
    lifecycle {
      DRAFT -> REVIEW
      REVIEW -> PUBLISHED
      REVIEW -> DRAFT
      PUBLISHED -> ARCHIVED
      ARCHIVED -> PUBLISHED
    }
  }
  
  entity Comment {
    id: UUID [immutable, unique]
    post_id: UUID [indexed]
    author_id: UUID [indexed]
    parent_id: UUID? [indexed]
    
    content: String
    
    approved: Boolean
    approved_at: Timestamp?
    approved_by: UUID?
    
    spam_score: Decimal?
    
    like_count: Int
    reply_count: Int
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      content.length > 0
      like_count >= 0
      reply_count >= 0
      approved implies approved_at != null
    }
  }
  
  entity Category {
    id: UUID [immutable, unique]
    slug: String [unique, indexed]
    parent_id: UUID? [indexed]
    
    name: String
    description: String?
    
    post_count: Int
    
    sort_order: Int
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      name.length > 0
      post_count >= 0
    }
  }
  
  entity Tag {
    id: UUID [immutable, unique]
    slug: String [unique, indexed]
    name: String
    
    post_count: Int
    
    created_at: Timestamp [immutable]
    
    invariants {
      name.length > 0
      post_count >= 0
    }
  }
  
  // === BEHAVIORS ===
  
  // Post CRUD
  
  behavior CreatePost {
    description: "Create a new post"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      title: String
      content: String
      excerpt: String?
      slug: String?
      visibility: Visibility?
      tags: List<String>?
      categories: List<UUID>?
      featured_image: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: Post
      
      errors {
        SLUG_EXISTS {
          when: "Slug is already taken"
          retriable: false
        }
        INVALID_CATEGORY {
          when: "Category does not exist"
          retriable: false
        }
        CONTENT_TOO_SHORT {
          when: "Content is too short"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.title.length > 0
      input.content.length > 0
      input.slug == null or not Post.exists(slug: input.slug)
      input.categories == null or all(c in input.categories: Category.exists(c))
    }
    
    postconditions {
      success implies {
        Post.exists(result.id)
        result.author_id == actor.id
        result.title == input.title
        result.published == false
        result.view_count == 0
        result.like_count == 0
        result.comment_count == 0
      }
    }
  }
  
  behavior GetPost {
    description: "Get post by ID or slug"
    
    actors {
      Anonymous { }
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      id: UUID?
      slug: String?
    }
    
    output {
      success: Post
      
      errors {
        POST_NOT_FOUND {
          when: "Post does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "Not authorized to view this post"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.id != null or input.slug != null
    }
    
    postconditions {
      success implies {
        // View count incremented for public views
        Post.lookup(result.id).view_count >= old(Post.lookup(result.id).view_count)
      }
    }
  }
  
  behavior UpdatePost {
    description: "Update an existing post"
    
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
      tags: List<String>?
      categories: List<UUID>?
      featured_image: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: Post
      
      errors {
        POST_NOT_FOUND {
          when: "Post does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to update this post"
          retriable: false
        }
        SLUG_EXISTS {
          when: "Slug is already taken by another post"
          retriable: false
        }
      }
    }
    
    preconditions {
      Post.exists(input.id)
      Post.lookup(input.id).author_id == actor.id or actor.role == ADMIN
    }
    
    postconditions {
      success implies {
        result.updated_at > old(Post.lookup(input.id).updated_at)
        input.title != null implies result.title == input.title
        input.content != null implies result.content == input.content
      }
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
      hard_delete: Boolean?
    }
    
    output {
      success: Boolean
      
      errors {
        POST_NOT_FOUND {
          when: "Post does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to delete this post"
          retriable: false
        }
      }
    }
    
    preconditions {
      Post.exists(input.id)
      Post.lookup(input.id).author_id == actor.id or actor.role == ADMIN
    }
    
    postconditions {
      success implies {
        input.hard_delete == true implies not Post.exists(input.id)
        // Soft delete keeps the record but marks as archived
      }
    }
  }
  
  behavior ListPosts {
    description: "List posts with pagination and filtering"
    
    actors {
      Anonymous { }
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      page: Int?
      page_size: Int?
      author_id: UUID?
      category_id: UUID?
      tag: String?
      visibility: Visibility?
      published_only: Boolean?
      sort_by: String?
      sort_order: String?
      search: String?
    }
    
    output {
      success: {
        posts: List<Post>
        pagination: Pagination
      }
    }
    
    preconditions {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }
    
    postconditions {
      success implies {
        result.posts.length <= result.pagination.page_size
        result.pagination.page >= 1
      }
    }
  }
  
  behavior PublishPost {
    description: "Publish a draft post"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      id: UUID
    }
    
    output {
      success: Post
      
      errors {
        POST_NOT_FOUND {
          when: "Post does not exist"
          retriable: false
        }
        ALREADY_PUBLISHED {
          when: "Post is already published"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to publish this post"
          retriable: false
        }
      }
    }
    
    preconditions {
      Post.exists(input.id)
      Post.lookup(input.id).published == false
    }
    
    postconditions {
      success implies {
        result.published == true
        result.published_at != null
      }
    }
  }
  
  // Comment CRUD
  
  behavior CreateComment {
    description: "Create a comment on a post"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      post_id: UUID
      parent_id: UUID?
      content: String
    }
    
    output {
      success: Comment
      
      errors {
        POST_NOT_FOUND {
          when: "Post does not exist"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "Parent comment does not exist"
          retriable: false
        }
        COMMENTS_DISABLED {
          when: "Comments are disabled on this post"
          retriable: false
        }
        SPAM_DETECTED {
          when: "Comment was flagged as spam"
          retriable: false
        }
      }
    }
    
    preconditions {
      Post.exists(input.post_id)
      input.parent_id == null or Comment.exists(input.parent_id)
      input.content.length > 0
    }
    
    postconditions {
      success implies {
        Comment.exists(result.id)
        result.post_id == input.post_id
        result.author_id == actor.id
        Post.lookup(input.post_id).comment_count == old(Post.lookup(input.post_id).comment_count) + 1
      }
    }
    
    temporal {
      response within 500.ms
      eventually within 30.seconds: spam_check_complete
    }
  }
  
  behavior ListComments {
    description: "List comments for a post"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      post_id: UUID
      parent_id: UUID?
      page: Int?
      page_size: Int?
      sort_by: String?
      sort_order: String?
    }
    
    output {
      success: {
        comments: List<Comment>
        pagination: Pagination
      }
    }
    
    preconditions {
      Post.exists(input.post_id)
    }
  }
  
  behavior DeleteComment {
    description: "Delete a comment"
    
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
        COMMENT_NOT_FOUND {
          when: "Comment does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to delete this comment"
          retriable: false
        }
      }
    }
    
    preconditions {
      Comment.exists(input.id)
      Comment.lookup(input.id).author_id == actor.id or actor.role == ADMIN
    }
    
    postconditions {
      success implies {
        not Comment.exists(input.id)
      }
    }
  }
  
  // Category CRUD
  
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
      sort_order: Int?
    }
    
    output {
      success: Category
      
      errors {
        SLUG_EXISTS {
          when: "Slug is already taken"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "Parent category does not exist"
          retriable: false
        }
        CIRCULAR_REFERENCE {
          when: "Would create circular reference"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.name.length > 0
      input.parent_id == null or Category.exists(input.parent_id)
    }
    
    postconditions {
      success implies {
        Category.exists(result.id)
        result.name == input.name
        result.post_count == 0
      }
    }
  }
  
  behavior ListCategories {
    description: "List all categories"
    
    actors {
      Anonymous { }
    }
    
    input {
      parent_id: UUID?
      include_counts: Boolean?
    }
    
    output {
      success: List<Category>
    }
  }
  
  // Tag operations
  
  behavior GetOrCreateTag {
    description: "Get existing tag or create new one"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      name: String
    }
    
    output {
      success: Tag
    }
    
    preconditions {
      input.name.length > 0
    }
    
    postconditions {
      success implies {
        Tag.exists(result.id)
        result.name == input.name or result.slug == input.name.lowercase
      }
    }
  }
  
  behavior ListTags {
    description: "List popular tags"
    
    actors {
      Anonymous { }
    }
    
    input {
      limit: Int?
      min_count: Int?
    }
    
    output {
      success: List<Tag>
    }
  }
  
  // === SCENARIOS ===
  
  scenarios CreatePost {
    scenario "create draft post" {
      when {
        result = CreatePost(
          title: "My First Post",
          content: "This is the content of my first post."
        )
      }
      
      then {
        result is success
        result.published == false
        result.view_count == 0
      }
    }
    
    scenario "create post with all fields" {
      given {
        category = CreateCategory(name: "Technology")
      }
      
      when {
        result = CreatePost(
          title: "Full Post",
          content: "Detailed content here.",
          excerpt: "A brief summary.",
          slug: "full-post",
          visibility: PUBLIC,
          tags: ["tech", "tutorial"],
          categories: [category.id],
          metadata: { "key": "value" }
        )
      }
      
      then {
        result is success
        result.slug == "full-post"
        result.tags == ["tech", "tutorial"]
      }
    }
  }
  
  scenarios UpdatePost {
    scenario "update title" {
      given {
        post = CreatePost(title: "Original", content: "Content")
      }
      
      when {
        result = UpdatePost(id: post.id, title: "Updated Title")
      }
      
      then {
        result is success
        result.title == "Updated Title"
        result.content == "Content"
      }
    }
  }
  
  scenarios PublishPost {
    scenario "publish draft" {
      given {
        post = CreatePost(title: "Draft", content: "Content")
      }
      
      when {
        result = PublishPost(id: post.id)
      }
      
      then {
        result is success
        result.published == true
        result.published_at != null
      }
    }
  }
}
