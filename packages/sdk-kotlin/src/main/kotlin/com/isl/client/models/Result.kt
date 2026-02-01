@file:Suppress("unused")

package com.isl.client.models

/**
 * Sealed class hierarchy for CreateUser operation results
 * 
 * Represents all possible outcomes of the createUser behavior
 * as defined in ISL specification.
 */
sealed class CreateUserResult {
    /**
     * Successful user creation
     * 
     * Postconditions:
     * - user.email == input.email
     * - user.username == input.username
     * - user.status == PENDING
     */
    data class Success(val user: User) : CreateUserResult()
    
    /**
     * Error cases for user creation
     */
    sealed class Error : CreateUserResult() {
        /**
         * Email already exists in the system
         */
        data object DuplicateEmail : Error()
        
        /**
         * Username already taken
         */
        data object DuplicateUsername : Error()
        
        /**
         * Input validation failed
         */
        data class InvalidInput(val message: String, val field: String? = null) : Error()
        
        /**
         * Rate limit exceeded
         */
        data class RateLimited(val retryAfter: Long) : Error()
        
        /**
         * Server error occurred
         */
        data class ServerError(val message: String, val code: String? = null) : Error()
        
        /**
         * Network error occurred
         */
        data class NetworkError(val cause: Throwable) : Error()
    }
}

/**
 * Sealed class hierarchy for GetUser operation results
 */
sealed class GetUserResult {
    data class Success(val user: User) : GetUserResult()
    
    sealed class Error : GetUserResult() {
        data object NotFound : Error()
        data object Unauthorized : Error()
        data class ServerError(val message: String) : Error()
        data class NetworkError(val cause: Throwable) : Error()
    }
}

/**
 * Sealed class hierarchy for UpdateUser operation results
 */
sealed class UpdateUserResult {
    data class Success(val user: User) : UpdateUserResult()
    
    sealed class Error : UpdateUserResult() {
        data object NotFound : Error()
        data object Unauthorized : Error()
        data object Forbidden : Error()
        data class InvalidInput(val message: String, val field: String? = null) : Error()
        data class Conflict(val message: String) : Error()
        data class RateLimited(val retryAfter: Long) : Error()
        data class ServerError(val message: String) : Error()
        data class NetworkError(val cause: Throwable) : Error()
    }
}

/**
 * Sealed class hierarchy for DeleteUser operation results
 */
sealed class DeleteUserResult {
    data object Success : DeleteUserResult()
    
    sealed class Error : DeleteUserResult() {
        data object NotFound : Error()
        data object Unauthorized : Error()
        data object Forbidden : Error()
        data class ServerError(val message: String) : Error()
        data class NetworkError(val cause: Throwable) : Error()
    }
}

/**
 * Sealed class hierarchy for ListUsers operation results
 */
sealed class ListUsersResult {
    data class Success(
        val users: List<User>,
        val nextPageToken: String? = null,
        val totalCount: Int? = null
    ) : ListUsersResult()
    
    sealed class Error : ListUsersResult() {
        data object Unauthorized : Error()
        data class InvalidInput(val message: String) : Error()
        data class ServerError(val message: String) : Error()
        data class NetworkError(val cause: Throwable) : Error()
    }
}

/**
 * Sealed class hierarchy for SearchUsers operation results
 */
sealed class SearchUsersResult {
    data class Success(
        val users: List<User>,
        val nextPageToken: String? = null,
        val totalCount: Int? = null
    ) : SearchUsersResult()
    
    sealed class Error : SearchUsersResult() {
        data object Unauthorized : Error()
        data class InvalidInput(val message: String) : Error()
        data class ServerError(val message: String) : Error()
        data class NetworkError(val cause: Throwable) : Error()
    }
}

// ============================================================================
// Extension Functions
// ============================================================================

/**
 * Get the user if successful, null otherwise
 */
fun CreateUserResult.getOrNull(): User? = when (this) {
    is CreateUserResult.Success -> user
    is CreateUserResult.Error -> null
}

/**
 * Get the user or throw an exception
 */
fun CreateUserResult.getOrThrow(): User = when (this) {
    is CreateUserResult.Success -> user
    is CreateUserResult.Error -> throw toException()
}

/**
 * Get the user or a default value
 */
fun CreateUserResult.getOrElse(default: () -> User): User = when (this) {
    is CreateUserResult.Success -> user
    is CreateUserResult.Error -> default()
}

/**
 * Execute block if successful
 */
inline fun CreateUserResult.onSuccess(block: (User) -> Unit): CreateUserResult {
    if (this is CreateUserResult.Success) {
        block(user)
    }
    return this
}

/**
 * Execute block if error
 */
inline fun CreateUserResult.onError(block: (CreateUserResult.Error) -> Unit): CreateUserResult {
    if (this is CreateUserResult.Error) {
        block(this)
    }
    return this
}

/**
 * Map success value
 */
inline fun <T> CreateUserResult.map(transform: (User) -> T): T? = when (this) {
    is CreateUserResult.Success -> transform(user)
    is CreateUserResult.Error -> null
}

/**
 * Convert error to exception
 */
fun CreateUserResult.Error.toException(): Exception = when (this) {
    is CreateUserResult.Error.DuplicateEmail -> DuplicateEmailException()
    is CreateUserResult.Error.DuplicateUsername -> DuplicateUsernameException()
    is CreateUserResult.Error.InvalidInput -> InvalidInputException(message, field)
    is CreateUserResult.Error.RateLimited -> RateLimitedException(retryAfter)
    is CreateUserResult.Error.ServerError -> ServerErrorException(message, code)
    is CreateUserResult.Error.NetworkError -> NetworkErrorException(cause)
}

// Similar extensions for other result types
fun GetUserResult.getOrNull(): User? = when (this) {
    is GetUserResult.Success -> user
    is GetUserResult.Error -> null
}

fun GetUserResult.getOrThrow(): User = when (this) {
    is GetUserResult.Success -> user
    is GetUserResult.Error -> throw when (this) {
        is GetUserResult.Error.NotFound -> NotFoundException("User not found")
        is GetUserResult.Error.Unauthorized -> UnauthorizedException()
        is GetUserResult.Error.ServerError -> ServerErrorException(message)
        is GetUserResult.Error.NetworkError -> NetworkErrorException(cause)
    }
}

fun UpdateUserResult.getOrNull(): User? = when (this) {
    is UpdateUserResult.Success -> user
    is UpdateUserResult.Error -> null
}

fun ListUsersResult.getOrNull(): List<User>? = when (this) {
    is ListUsersResult.Success -> users
    is ListUsersResult.Error -> null
}

fun SearchUsersResult.getOrNull(): List<User>? = when (this) {
    is SearchUsersResult.Success -> users
    is SearchUsersResult.Error -> null
}

// ============================================================================
// Check Functions
// ============================================================================

/**
 * Check if result is successful
 */
val CreateUserResult.isSuccess: Boolean
    get() = this is CreateUserResult.Success

/**
 * Check if result is an error
 */
val CreateUserResult.isError: Boolean
    get() = this is CreateUserResult.Error

val GetUserResult.isSuccess: Boolean
    get() = this is GetUserResult.Success

val GetUserResult.isError: Boolean
    get() = this is GetUserResult.Error

val UpdateUserResult.isSuccess: Boolean
    get() = this is UpdateUserResult.Success

val UpdateUserResult.isError: Boolean
    get() = this is UpdateUserResult.Error

val DeleteUserResult.isSuccess: Boolean
    get() = this is DeleteUserResult.Success

val DeleteUserResult.isError: Boolean
    get() = this is DeleteUserResult.Error

val ListUsersResult.isSuccess: Boolean
    get() = this is ListUsersResult.Success

val ListUsersResult.isError: Boolean
    get() = this is ListUsersResult.Error
