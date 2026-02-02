// CRUD: Comments
domain CRUDComments {
  version: "1.0.0"

  enum CommentStatus {
    PENDING
    APPROVED
    SPAM
    DELETED
  }

  entity Comment {
    id: UUID [immutable, unique]
    post_id: UUID [indexed]
    author_id: UUID [indexed]
    parent_id: UUID? [indexed]
    content: String
    status: CommentStatus [default: PENDING]
    like_count: Int [default: 0]
    reply_count: Int [default: 0]
    edited: Boolean [default: false]
    edited_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      content.length > 0
      like_count >= 0
      reply_count >= 0
      edited implies edited_at != null
    }

    lifecycle {
      PENDING -> APPROVED
      PENDING -> SPAM
      APPROVED -> DELETED
      SPAM -> DELETED
    }
  }

  behavior CreateComment {
    description: "Create a comment"

    actors {
      User { must: authenticated }
    }

    input {
      post_id: UUID
      content: String
      parent_id: UUID?
    }

    output {
      success: Comment

      errors {
        POST_NOT_FOUND {
          when: "Post not found"
          retriable: false
        }
        PARENT_NOT_FOUND {
          when: "Parent comment not found"
          retriable: false
        }
        COMMENTS_DISABLED {
          when: "Comments are disabled"
          retriable: false
        }
        SPAM_DETECTED {
          when: "Comment flagged as spam"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many comments"
          retriable: true
          retry_after: 1m
        }
      }
    }

    pre {
      input.content.length > 0
      input.content.length <= 10000
      input.parent_id == null or Comment.exists(input.parent_id)
    }

    post success {
      - Comment.exists(result.id)
      - result.post_id == input.post_id
      - result.author_id == actor.id
    }

    temporal {
      - within 500ms (p99): response returned
      - eventually within 30s: spam check complete
    }

    security {
      - rate_limit 10 per minute per user
    }
  }

  behavior GetComment {
    description: "Get comment by ID"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      comment_id: UUID
    }

    output {
      success: Comment

      errors {
        NOT_FOUND {
          when: "Comment not found"
          retriable: false
        }
      }
    }

    pre {
      Comment.exists(input.comment_id)
    }
  }

  behavior UpdateComment {
    description: "Edit a comment"

    actors {
      User { must: authenticated }
    }

    input {
      comment_id: UUID
      content: String
    }

    output {
      success: Comment

      errors {
        NOT_FOUND {
          when: "Comment not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
        EDIT_WINDOW_CLOSED {
          when: "Edit window has passed"
          retriable: false
        }
      }
    }

    pre {
      Comment.exists(input.comment_id)
      Comment.lookup(input.comment_id).author_id == actor.id
      input.content.length > 0
    }

    post success {
      - result.content == input.content
      - result.edited == true
      - result.edited_at != null
    }
  }

  behavior DeleteComment {
    description: "Delete a comment"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      comment_id: UUID
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "Comment not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      Comment.exists(input.comment_id)
    }

    post success {
      - Comment.lookup(input.comment_id).status == DELETED
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
      status: CommentStatus?
      page: Int?
      page_size: Int?
      sort_by: String?
    }

    output {
      success: {
        comments: List<Comment>
        total_count: Int
        has_more: Boolean
      }
    }

    post success {
      - all(c in result.comments: c.post_id == input.post_id)
    }
  }

  behavior ApproveComment {
    description: "Approve a pending comment"

    actors {
      Moderator { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      comment_id: UUID
    }

    output {
      success: Comment

      errors {
        NOT_FOUND {
          when: "Comment not found"
          retriable: false
        }
        NOT_PENDING {
          when: "Comment not pending"
          retriable: false
        }
      }
    }

    pre {
      Comment.exists(input.comment_id)
      Comment.lookup(input.comment_id).status == PENDING
    }

    post success {
      - result.status == APPROVED
    }
  }

  scenarios CreateComment {
    scenario "create reply" {
      given {
        parent = Comment.create(post_id: "post-123")
      }

      when {
        result = CreateComment(
          post_id: "post-123",
          content: "This is a reply",
          parent_id: parent.id
        )
      }

      then {
        result is success
        result.parent_id == parent.id
      }
    }
  }
}
