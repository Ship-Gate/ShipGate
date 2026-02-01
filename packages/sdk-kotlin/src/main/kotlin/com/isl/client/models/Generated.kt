@file:Suppress("unused")

package com.isl.client.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

// ============================================================================
// Value Types - Compile-time validated types from ISL
// ============================================================================

/**
 * Email value type with built-in validation
 * 
 * @property value The underlying email string
 * @throws IllegalArgumentException if email format is invalid
 */
@JvmInline
value class Email(val value: String) {
    init {
        require(value.contains("@")) { "Invalid email format: must contain @" }
        require(value.length <= 254) { "Email too long: max 254 characters" }
        require(value.length >= 3) { "Email too short: min 3 characters" }
        require(!value.startsWith("@")) { "Invalid email format: cannot start with @" }
        require(!value.endsWith("@")) { "Invalid email format: cannot end with @" }
    }
    
    override fun toString(): String = value
}

/**
 * Username value type with built-in validation
 * 
 * @property value The underlying username string
 * @throws IllegalArgumentException if username format is invalid
 */
@JvmInline
value class Username(val value: String) {
    init {
        require(value.length in 3..30) { "Username must be 3-30 characters" }
        require(value.matches(Regex("^[a-zA-Z0-9_-]+$"))) { 
            "Username can only contain letters, numbers, underscores, and hyphens" 
        }
    }
    
    override fun toString(): String = value
}

/**
 * UserId value type
 * 
 * @property value The underlying ID string
 */
@JvmInline
value class UserId(val value: String) {
    init {
        require(value.isNotBlank()) { "UserId cannot be blank" }
    }
    
    override fun toString(): String = value
}

/**
 * Pagination token for cursor-based pagination
 */
@JvmInline
value class PageToken(val value: String) {
    override fun toString(): String = value
}

/**
 * Page size with bounds validation
 */
@JvmInline
value class PageSize(val value: Int) {
    init {
        require(value in 1..100) { "Page size must be between 1 and 100" }
    }
}

// ============================================================================
// Enums - State machines from ISL
// ============================================================================

/**
 * User status enumeration
 * 
 * State transitions:
 * - PENDING -> ACTIVE (after email verification)
 * - ACTIVE -> SUSPENDED (by admin)
 * - SUSPENDED -> ACTIVE (by admin)
 */
@Serializable
enum class UserStatus {
    @SerialName("PENDING")
    PENDING,
    
    @SerialName("ACTIVE")
    ACTIVE,
    
    @SerialName("SUSPENDED")
    SUSPENDED
}

/**
 * User role enumeration
 */
@Serializable
enum class UserRole {
    @SerialName("USER")
    USER,
    
    @SerialName("ADMIN")
    ADMIN,
    
    @SerialName("MODERATOR")
    MODERATOR
}

/**
 * Sort order for queries
 */
@Serializable
enum class SortOrder {
    @SerialName("ASC")
    ASC,
    
    @SerialName("DESC")
    DESC
}

// ============================================================================
// Entities - Domain models from ISL
// ============================================================================

/**
 * User entity representing a system user
 * 
 * @property id Unique identifier
 * @property email User's email address
 * @property username User's display name
 * @property status Current account status
 * @property role User's role in the system
 * @property createdAt Unix timestamp of creation
 * @property updatedAt Unix timestamp of last update
 * @property metadata Optional metadata map
 */
@Serializable
data class User(
    val id: String,
    val email: String,
    val username: String,
    val status: UserStatus,
    val role: UserRole = UserRole.USER,
    val createdAt: Long,
    val updatedAt: Long,
    val metadata: Map<String, String>? = null
) {
    /**
     * Check if user is active
     */
    val isActive: Boolean
        get() = status == UserStatus.ACTIVE
    
    /**
     * Check if user is pending verification
     */
    val isPending: Boolean
        get() = status == UserStatus.PENDING
    
    /**
     * Check if user is suspended
     */
    val isSuspended: Boolean
        get() = status == UserStatus.SUSPENDED
    
    /**
     * Check if user has admin privileges
     */
    val isAdmin: Boolean
        get() = role == UserRole.ADMIN
}

/**
 * User profile with extended information
 */
@Serializable
data class UserProfile(
    val user: User,
    val displayName: String? = null,
    val bio: String? = null,
    val avatarUrl: String? = null,
    val location: String? = null,
    val website: String? = null
)

/**
 * Paginated list response
 */
@Serializable
data class PaginatedList<T>(
    val items: List<T>,
    val nextPageToken: String? = null,
    val totalCount: Int? = null,
    val hasMore: Boolean = nextPageToken != null
)

/**
 * Audit log entry for tracking changes
 */
@Serializable
data class AuditEntry(
    val id: String,
    val entityType: String,
    val entityId: String,
    val action: String,
    val actorId: String?,
    val timestamp: Long,
    val changes: Map<String, ChangeValue>? = null
)

/**
 * Represents a change in an audit entry
 */
@Serializable
data class ChangeValue(
    val from: String?,
    val to: String?
)

// ============================================================================
// Behavior Inputs - Request DTOs from ISL
// ============================================================================

/**
 * Input for creating a new user
 * 
 * Preconditions:
 * - email must be valid format (contains @, max 254 chars)
 * - username must be 3-30 characters
 */
@Serializable
data class CreateUserInput(
    val email: String,
    val username: String,
    val role: UserRole = UserRole.USER,
    val metadata: Map<String, String>? = null
)

/**
 * Input for updating a user
 */
@Serializable
data class UpdateUserInput(
    val username: String? = null,
    val status: UserStatus? = null,
    val role: UserRole? = null,
    val metadata: Map<String, String>? = null
)

/**
 * Input for updating user profile
 */
@Serializable
data class UpdateProfileInput(
    val displayName: String? = null,
    val bio: String? = null,
    val avatarUrl: String? = null,
    val location: String? = null,
    val website: String? = null
)

/**
 * Input for listing users with pagination
 */
@Serializable
data class ListUsersInput(
    val status: UserStatus? = null,
    val role: UserRole? = null,
    val pageSize: Int = 20,
    val pageToken: String? = null,
    val sortBy: String = "createdAt",
    val sortOrder: SortOrder = SortOrder.DESC
)

/**
 * Input for searching users
 */
@Serializable
data class SearchUsersInput(
    val query: String,
    val fields: List<String> = listOf("email", "username"),
    val pageSize: Int = 20,
    val pageToken: String? = null
)

// ============================================================================
// WebSocket Messages
// ============================================================================

/**
 * WebSocket message wrapper
 */
@Serializable
data class WebSocketMessage<T>(
    val type: String,
    val payload: T,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * User update event from WebSocket
 */
@Serializable
data class UserUpdateEvent(
    val userId: String,
    val user: User,
    val changeType: ChangeType
)

/**
 * Type of change in an event
 */
@Serializable
enum class ChangeType {
    @SerialName("CREATED")
    CREATED,
    
    @SerialName("UPDATED")
    UPDATED,
    
    @SerialName("DELETED")
    DELETED
}
