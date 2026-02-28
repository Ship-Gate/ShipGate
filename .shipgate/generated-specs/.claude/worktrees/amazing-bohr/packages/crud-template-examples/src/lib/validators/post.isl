# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPostSchema, updatePostSchema, queryPostSchema, CreatePostInput, UpdatePostInput, QueryPostParams
# dependencies: zod

domain Post {
  version: "1.0.0"

  type CreatePostInput = String
  type UpdatePostInput = String
  type QueryPostParams = String

  invariants exports_present {
    - true
  }
}
