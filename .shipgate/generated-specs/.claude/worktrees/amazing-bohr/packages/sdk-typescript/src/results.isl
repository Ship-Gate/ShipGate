# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ok, err, ResultHelpers, CreateUserErrors, GetUserErrors, Result, BaseError, CreateUserError, GetUserError, UpdateUserError, DeleteUserError, ListUsersError, SearchUsersError, CreateUserResult, GetUserResult, UpdateUserResult, DeleteUserResult, ListUsersResult, SearchUsersResult
# dependencies: 

domain Results {
  version: "1.0.0"

  type Result = String
  type BaseError = String
  type CreateUserError = String
  type GetUserError = String
  type UpdateUserError = String
  type DeleteUserError = String
  type ListUsersError = String
  type SearchUsersError = String
  type CreateUserResult = String
  type GetUserResult = String
  type UpdateUserResult = String
  type DeleteUserResult = String
  type ListUsersResult = String
  type SearchUsersResult = String

  invariants exports_present {
    - true
  }
}
