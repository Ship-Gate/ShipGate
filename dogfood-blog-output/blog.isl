domain Blog version "1.0.0"

// Generated from: "A blog platform where authors can register, write posts with a rich text editor, add tags, and publish or save as draft. Readers can browse posts by tag, search by title/content, and leave comments. Authors can moderate comments on their posts (approve, delete). There's a public homepage showing recent posts, an author dashboard showing their posts and comment notifications, and an admin panel for managing users and flagged content. Posts support featured images via URL."
// Confidence: 85%
// Timestamp: 2026-02-14T07:45:37.688Z

entity Author {
  id: UUID
  email: Email
  name: String
  passwordHash: String
  invariant password never stored plain
}

entity Post {
  id: UUID
  title: String
  content: String
  status: String
  featuredImageUrl?: String
  authorId: UUID
  tags?: String
  invariant status in [draft, published]
}

entity Comment {
  id: UUID
  postId: UUID
  authorId?: UUID
  content: String
  status: String
  invariant status in [pending, approved, deleted]
}

behavior RegisterAuthor {
  // Author registration

  input {
    email: Email
    password: String
    name: String
  }

  output {
    success: Author
    errors {
      EmailAlreadyExists when "email is taken"
      WeakPassword when "password does not meet requirements"
    }
  }

  // Intent declarations
  @intent rate-limit-required
  @intent audit-required
  @intent no-pii-logging

  pre email valid
  pre password meets complexity
  pre rate limit not exceeded

  post success {
    author created
  }
  post success {
    password hashed
  }
  post success {
    audit event recorded
  }

  invariant password never logged

}

behavior CreatePost {
  // Create post (draft or published)

  input {
    title: String
    content: String
    tags?: String
    featuredImageUrl?: String
    status?: String
  }

  output {
    success: Post
    errors {
      ValidationError when "invalid input"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated as author
  pre title length > 0

  post success {
    post created
  }
  post success {
    post belongs to author
  }

}

behavior SearchPosts {
  // Search posts by title/content

  input {
    query: String
    tag?: String
  }

  output {
    success: Post
  }

  post success {
    returns matching published posts
  }

}

behavior CreateComment {
  // Reader leaves comment

  input {
    postId: UUID
    content: String
  }

  output {
    success: Comment
    errors {
      PostNotFound when "post does not exist"
      ValidationError when "content empty"
    }
  }

  // Intent declarations
  @intent rate-limit-required
  @intent audit-required

  pre post exists and is published
  pre rate limit not exceeded

  post success {
    comment created with status pending
  }

}

behavior ModerateComment {
  // Author approves or deletes comment

  input {
    commentId: UUID
    action: String
  }

  output {
    success: Comment
    errors {
      NotFound when "comment does not exist"
      Forbidden when "user is not post author"
    }
  }

  // Intent declarations
  @intent auth-required
  @intent audit-required

  pre user authenticated
  pre user is author of post

  post success {
    comment status updated
  }

}
