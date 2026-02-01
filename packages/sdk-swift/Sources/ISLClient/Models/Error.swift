import Foundation

// MARK: - Validation Errors

/// Errors thrown during client-side validation
public enum ValidationError: Error, Codable, Equatable, Sendable, LocalizedError {
    case emptyValue(field: String)
    case invalidEmail
    case invalidEmailFormat
    case emailTooLong
    case usernameTooShort
    case usernameTooLong
    case invalidUsernameFormat
    case invalidPhoneNumber
    case invalidURL
    case invalidURLScheme
    case valueTooShort(field: String, minimum: Int)
    case valueTooLong(field: String, maximum: Int)
    case valueOutOfRange(field: String, min: Double, max: Double)
    case patternMismatch(field: String, pattern: String)
    case requiredFieldMissing(field: String)
    case invalidFormat(field: String, expected: String)
    
    public var errorDescription: String? {
        switch self {
        case .emptyValue(let field):
            return "\(field) cannot be empty"
        case .invalidEmail:
            return "Invalid email address"
        case .invalidEmailFormat:
            return "Email format is invalid"
        case .emailTooLong:
            return "Email address is too long (max 254 characters)"
        case .usernameTooShort:
            return "Username must be at least 3 characters"
        case .usernameTooLong:
            return "Username cannot exceed 30 characters"
        case .invalidUsernameFormat:
            return "Username can only contain letters, numbers, and underscores"
        case .invalidPhoneNumber:
            return "Invalid phone number format"
        case .invalidURL:
            return "Invalid URL"
        case .invalidURLScheme:
            return "URL must use HTTP or HTTPS"
        case .valueTooShort(let field, let minimum):
            return "\(field) must be at least \(minimum) characters"
        case .valueTooLong(let field, let maximum):
            return "\(field) cannot exceed \(maximum) characters"
        case .valueOutOfRange(let field, let min, let max):
            return "\(field) must be between \(min) and \(max)"
        case .patternMismatch(let field, let pattern):
            return "\(field) does not match required pattern: \(pattern)"
        case .requiredFieldMissing(let field):
            return "\(field) is required"
        case .invalidFormat(let field, let expected):
            return "\(field) has invalid format, expected: \(expected)"
        }
    }
}

// MARK: - Verification Errors

/// Errors thrown during runtime verification
public enum VerificationError: Error, Codable, Equatable, Sendable, LocalizedError {
    case preconditionFailed(String)
    case postconditionFailed(String)
    case invariantViolation(String)
    case contractViolation(behavior: String, message: String)
    case typeConstraintViolation(type: String, message: String)
    
    public var errorDescription: String? {
        switch self {
        case .preconditionFailed(let message):
            return "Precondition failed: \(message)"
        case .postconditionFailed(let message):
            return "Postcondition failed: \(message)"
        case .invariantViolation(let message):
            return "Invariant violation: \(message)"
        case .contractViolation(let behavior, let message):
            return "Contract violation in \(behavior): \(message)"
        case .typeConstraintViolation(let type, let message):
            return "Type constraint violation for \(type): \(message)"
        }
    }
}

// MARK: - API Errors (Generated from ISL)

/// Create user errors
/// Generated from ISL: `behavior CreateUser errors`
public enum CreateUserError: Error, Codable, Equatable, Sendable, LocalizedError {
    case duplicateEmail
    case duplicateUsername
    case invalidInput(message: String)
    case rateLimited(retryAfter: TimeInterval)
    case serviceUnavailable
    
    public var errorDescription: String? {
        switch self {
        case .duplicateEmail:
            return "A user with this email already exists"
        case .duplicateUsername:
            return "A user with this username already exists"
        case .invalidInput(let message):
            return "Invalid input: \(message)"
        case .rateLimited(let retryAfter):
            return "Rate limited. Please retry after \(Int(retryAfter)) seconds"
        case .serviceUnavailable:
            return "Service is temporarily unavailable"
        }
    }
}

/// Get user errors
/// Generated from ISL: `behavior GetUser errors`
public enum GetUserError: Error, Codable, Equatable, Sendable, LocalizedError {
    case notFound
    case unauthorized
    case forbidden
    
    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "User not found"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        }
    }
}

/// Update user errors
/// Generated from ISL: `behavior UpdateUser errors`
public enum UpdateUserError: Error, Codable, Equatable, Sendable, LocalizedError {
    case notFound
    case unauthorized
    case forbidden
    case invalidInput(message: String)
    case concurrentModification
    
    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "User not found"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .invalidInput(let message):
            return "Invalid input: \(message)"
        case .concurrentModification:
            return "User was modified by another request"
        }
    }
}

/// Delete user errors
/// Generated from ISL: `behavior DeleteUser errors`
public enum DeleteUserError: Error, Codable, Equatable, Sendable, LocalizedError {
    case notFound
    case unauthorized
    case forbidden
    case cannotDeleteSelf
    
    public var errorDescription: String? {
        switch self {
        case .notFound:
            return "User not found"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .cannotDeleteSelf:
            return "Cannot delete your own account"
        }
    }
}

/// List users errors
/// Generated from ISL: `behavior ListUsers errors`
public enum ListUsersError: Error, Codable, Equatable, Sendable, LocalizedError {
    case unauthorized
    case forbidden
    case invalidPagination
    
    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .invalidPagination:
            return "Invalid pagination parameters"
        }
    }
}

/// Create organization errors
/// Generated from ISL: `behavior CreateOrganization errors`
public enum CreateOrganizationError: Error, Codable, Equatable, Sendable, LocalizedError {
    case duplicateSlug
    case invalidInput(message: String)
    case quotaExceeded
    case unauthorized
    
    public var errorDescription: String? {
        switch self {
        case .duplicateSlug:
            return "An organization with this slug already exists"
        case .invalidInput(let message):
            return "Invalid input: \(message)"
        case .quotaExceeded:
            return "Organization quota exceeded"
        case .unauthorized:
            return "Authentication required"
        }
    }
}

/// Create API key errors
/// Generated from ISL: `behavior CreateAPIKey errors`
public enum CreateAPIKeyError: Error, Codable, Equatable, Sendable, LocalizedError {
    case unauthorized
    case forbidden
    case quotaExceeded
    case invalidPermissions
    
    public var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .quotaExceeded:
            return "API key quota exceeded"
        case .invalidPermissions:
            return "Invalid permission configuration"
        }
    }
}

// MARK: - Client Errors

/// ISL Client errors
public enum ISLClientError: Error, Sendable, LocalizedError {
    case networkError(underlying: Error)
    case decodingError(underlying: Error)
    case encodingError(underlying: Error)
    case validationError(ValidationError)
    case verificationError(VerificationError)
    case httpError(statusCode: Int, message: String?)
    case unauthorized
    case forbidden
    case notFound
    case rateLimited(retryAfter: TimeInterval?)
    case serverError(statusCode: Int)
    case timeout
    case cancelled
    case invalidResponse
    case invalidURL
    case noData
    case unknown
    
    public var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Failed to encode request: \(error.localizedDescription)"
        case .validationError(let error):
            return error.localizedDescription
        case .verificationError(let error):
            return error.localizedDescription
        case .httpError(let statusCode, let message):
            return "HTTP error \(statusCode): \(message ?? "Unknown error")"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .rateLimited(let retryAfter):
            if let retryAfter = retryAfter {
                return "Rate limited. Retry after \(Int(retryAfter)) seconds"
            }
            return "Rate limited"
        case .serverError(let statusCode):
            return "Server error: \(statusCode)"
        case .timeout:
            return "Request timed out"
        case .cancelled:
            return "Request was cancelled"
        case .invalidResponse:
            return "Invalid server response"
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .unknown:
            return "An unknown error occurred"
        }
    }
    
    public var isRetryable: Bool {
        switch self {
        case .networkError, .timeout, .serverError, .rateLimited:
            return true
        default:
            return false
        }
    }
}

// MARK: - Error Response

/// Standard error response from API
public struct ErrorResponse: Codable, Sendable {
    public let code: String
    public let message: String
    public let details: [String: String]?
    public let requestId: String?
    
    public init(code: String, message: String, details: [String: String]? = nil, requestId: String? = nil) {
        self.code = code
        self.message = message
        self.details = details
        self.requestId = requestId
    }
}

// MARK: - Error Mapping

/// Map HTTP status codes to errors
public func mapHTTPError(statusCode: Int, response: ErrorResponse?) -> ISLClientError {
    switch statusCode {
    case 401:
        return .unauthorized
    case 403:
        return .forbidden
    case 404:
        return .notFound
    case 429:
        return .rateLimited(retryAfter: nil)
    case 500...599:
        return .serverError(statusCode: statusCode)
    default:
        return .httpError(statusCode: statusCode, message: response?.message)
    }
}
