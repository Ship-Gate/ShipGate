package com.isl.client.models

/**
 * Base exception for ISL SDK errors
 */
sealed class ISLException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

/**
 * Validation errors - thrown when preconditions fail
 */
class ValidationException(
    message: String,
    val field: String? = null,
    val value: Any? = null
) : ISLException("Validation failed: $message")

/**
 * Precondition violation - thrown when ISL preconditions are not met
 */
class PreconditionViolationException(
    message: String,
    val precondition: String,
    val actualValue: Any? = null
) : ISLException("Precondition violated: $message")

/**
 * Postcondition violation - thrown when server response doesn't match ISL contract
 */
class PostconditionViolationException(
    message: String,
    val postcondition: String,
    val expectedValue: Any?,
    val actualValue: Any?
) : ISLException("Postcondition violated: $message (expected: $expectedValue, actual: $actualValue)")

/**
 * Network errors - connection failures, timeouts, etc.
 */
class NetworkErrorException(
    cause: Throwable,
    val isTimeout: Boolean = false,
    val isConnectionError: Boolean = false
) : ISLException("Network error: ${cause.message}", cause)

/**
 * Server errors - 5xx responses
 */
class ServerErrorException(
    message: String,
    val statusCode: String? = null,
    val errorCode: String? = null
) : ISLException("Server error: $message")

/**
 * Unauthorized - 401 responses
 */
class UnauthorizedException(
    message: String = "Unauthorized"
) : ISLException(message)

/**
 * Forbidden - 403 responses
 */
class ForbiddenException(
    message: String = "Forbidden"
) : ISLException(message)

/**
 * Not found - 404 responses
 */
class NotFoundException(
    message: String = "Resource not found",
    val resourceType: String? = null,
    val resourceId: String? = null
) : ISLException(message)

/**
 * Conflict - 409 responses (duplicate resources, etc.)
 */
class ConflictException(
    message: String,
    val conflictField: String? = null
) : ISLException(message)

/**
 * Duplicate email error
 */
class DuplicateEmailException(
    val email: String? = null
) : ISLException("Email already exists${email?.let { ": $it" } ?: ""}")

/**
 * Duplicate username error
 */
class DuplicateUsernameException(
    val username: String? = null
) : ISLException("Username already exists${username?.let { ": $it" } ?: ""}")

/**
 * Invalid input - 400 responses
 */
class InvalidInputException(
    message: String,
    val field: String? = null,
    val details: Map<String, String>? = null
) : ISLException("Invalid input: $message")

/**
 * Rate limited - 429 responses
 */
class RateLimitedException(
    val retryAfterSeconds: Long,
    message: String = "Rate limited"
) : ISLException("$message. Retry after $retryAfterSeconds seconds")

/**
 * Timeout exception
 */
class TimeoutException(
    message: String = "Request timed out",
    val timeoutMs: Long? = null
) : ISLException(message)

/**
 * Serialization error - when response can't be parsed
 */
class SerializationException(
    message: String,
    cause: Throwable? = null,
    val responseBody: String? = null
) : ISLException("Serialization error: $message", cause)

// ============================================================================
// Error Response Models
// ============================================================================

/**
 * Standard error response from API
 */
@kotlinx.serialization.Serializable
data class ErrorResponse(
    val error: ErrorDetail,
    val requestId: String? = null,
    val timestamp: Long? = null
)

/**
 * Error detail in response
 */
@kotlinx.serialization.Serializable
data class ErrorDetail(
    val code: String,
    val message: String,
    val field: String? = null,
    val details: Map<String, String>? = null
)

/**
 * Validation error response with multiple errors
 */
@kotlinx.serialization.Serializable
data class ValidationErrorResponse(
    val errors: List<FieldError>,
    val message: String = "Validation failed"
)

/**
 * Individual field validation error
 */
@kotlinx.serialization.Serializable
data class FieldError(
    val field: String,
    val message: String,
    val code: String? = null,
    val rejectedValue: String? = null
)

// ============================================================================
// Error Code Constants
// ============================================================================

/**
 * Standard error codes
 */
object ErrorCodes {
    // Validation errors (4xx)
    const val INVALID_INPUT = "INVALID_INPUT"
    const val VALIDATION_FAILED = "VALIDATION_FAILED"
    const val MISSING_FIELD = "MISSING_FIELD"
    const val INVALID_FORMAT = "INVALID_FORMAT"
    const val OUT_OF_RANGE = "OUT_OF_RANGE"
    
    // Authentication/Authorization errors
    const val UNAUTHORIZED = "UNAUTHORIZED"
    const val FORBIDDEN = "FORBIDDEN"
    const val TOKEN_EXPIRED = "TOKEN_EXPIRED"
    const val INVALID_TOKEN = "INVALID_TOKEN"
    
    // Resource errors
    const val NOT_FOUND = "NOT_FOUND"
    const val ALREADY_EXISTS = "ALREADY_EXISTS"
    const val DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
    const val DUPLICATE_USERNAME = "DUPLICATE_USERNAME"
    const val CONFLICT = "CONFLICT"
    
    // Rate limiting
    const val RATE_LIMITED = "RATE_LIMITED"
    const val QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    
    // Server errors (5xx)
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
    const val SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    const val DATABASE_ERROR = "DATABASE_ERROR"
    const val EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    
    // Network errors
    const val NETWORK_ERROR = "NETWORK_ERROR"
    const val TIMEOUT = "TIMEOUT"
    const val CONNECTION_FAILED = "CONNECTION_FAILED"
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Convert HTTP status code to appropriate exception
 */
fun httpStatusToException(
    statusCode: Int,
    message: String,
    body: String? = null
): ISLException = when (statusCode) {
    400 -> InvalidInputException(message)
    401 -> UnauthorizedException(message)
    403 -> ForbiddenException(message)
    404 -> NotFoundException(message)
    409 -> ConflictException(message)
    429 -> RateLimitedException(60, message)
    in 500..599 -> ServerErrorException(message, statusCode.toString())
    else -> ServerErrorException("Unexpected error: $message", statusCode.toString())
}
