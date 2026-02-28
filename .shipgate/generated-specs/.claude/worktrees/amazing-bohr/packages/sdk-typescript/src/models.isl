# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isActive, isPending, isSuspended, isAdmin, parseUser, UserStatus, UserRole, SortOrder, ChangeType, Email, Username, UserId, PageToken, User, UserProfile, PaginatedList, AuditEntry, CreateUserInput, UpdateUserInput, UpdateProfileInput, ListUsersInput, SearchUsersInput, UserUpdateEvent, WebSocketMessage
# dependencies: 

domain Models {
  version: "1.0.0"

  type Email = String
  type Username = String
  type UserId = String
  type PageToken = String
  type User = String
  type UserProfile = String
  type PaginatedList = String
  type AuditEntry = String
  type CreateUserInput = String
  type UpdateUserInput = String
  type UpdateProfileInput = String
  type ListUsersInput = String
  type SearchUsersInput = String
  type UserUpdateEvent = String
  type WebSocketMessage = String

  invariants exports_present {
    - true
  }
}
