# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: listPosts, getPost, createPost, updatePost, deletePost, Post, CreatePostInput, UpdatePostInput, ListPostParams, ListPostResult
# dependencies: 

domain Post {
  version: "1.0.0"

  type Post = String
  type CreatePostInput = String
  type UpdatePostInput = String
  type ListPostParams = String
  type ListPostResult = String

  invariants exports_present {
    - true
  }
}
