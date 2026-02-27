import Foundation

// MARK: - API Response Types

/// Generic API response wrapper
public enum APIResponse<Success: Codable & Sendable, Failure: Error & Codable & Sendable>: Sendable {
    case success(Success)
    case failure(Failure)
    
    public var value: Success? {
        if case .success(let value) = self {
            return value
        }
        return nil
    }
    
    public var error: Failure? {
        if case .failure(let error) = self {
            return error
        }
        return nil
    }
    
    public func get() throws -> Success {
        switch self {
        case .success(let value):
            return value
        case .failure(let error):
            throw error
        }
    }
    
    public func map<T: Codable & Sendable>(_ transform: (Success) throws -> T) rethrows -> APIResponse<T, Failure> {
        switch self {
        case .success(let value):
            return .success(try transform(value))
        case .failure(let error):
            return .failure(error)
        }
    }
    
    public func mapError<E: Error & Codable & Sendable>(_ transform: (Failure) -> E) -> APIResponse<Success, E> {
        switch self {
        case .success(let value):
            return .success(value)
        case .failure(let error):
            return .failure(transform(error))
        }
    }
}

// MARK: - Result Type Aliases for Behaviors

/// Create user result
/// Generated from ISL: `behavior CreateUser`
public typealias CreateUserResult = APIResponse<User, CreateUserError>

/// Get user result
/// Generated from ISL: `behavior GetUser`
public typealias GetUserResult = APIResponse<User, GetUserError>

/// Update user result
/// Generated from ISL: `behavior UpdateUser`
public typealias UpdateUserResult = APIResponse<User, UpdateUserError>

/// Delete user result
/// Generated from ISL: `behavior DeleteUser`
public typealias DeleteUserResult = APIResponse<Void, DeleteUserError>

/// List users result
/// Generated from ISL: `behavior ListUsers`
public typealias ListUsersResult = APIResponse<PaginatedResponse<User>, ListUsersError>

/// Create organization result
/// Generated from ISL: `behavior CreateOrganization`
public typealias CreateOrganizationResult = APIResponse<Organization, CreateOrganizationError>

/// Create API key result
/// Generated from ISL: `behavior CreateAPIKey`
public typealias CreateAPIKeyResult = APIResponse<APIKeyWithSecret, CreateAPIKeyError>

// MARK: - Special Response Types

/// API key with secret (only returned on creation)
public struct APIKeyWithSecret: Codable, Sendable {
    public let apiKey: APIKey
    public let secret: String
    
    public init(apiKey: APIKey, secret: String) {
        self.apiKey = apiKey
        self.secret = secret
    }
}

/// Empty response for void returns
public struct EmptyResponse: Codable, Equatable, Sendable {
    public init() {}
}

// MARK: - Void Codable Conformance

extension Void: @retroactive Codable {
    public init(from decoder: Decoder) throws {
        // Nothing to decode
    }
    
    public func encode(to encoder: Encoder) throws {
        // Nothing to encode
    }
}

// MARK: - Response Metadata

/// Response metadata from API
public struct ResponseMetadata: Codable, Sendable {
    public let requestId: String
    public let timestamp: Date
    public let processingTime: TimeInterval
    public let serverVersion: String?
    
    public init(
        requestId: String,
        timestamp: Date,
        processingTime: TimeInterval,
        serverVersion: String? = nil
    ) {
        self.requestId = requestId
        self.timestamp = timestamp
        self.processingTime = processingTime
        self.serverVersion = serverVersion
    }
}

/// Full API response with metadata
public struct FullAPIResponse<T: Codable & Sendable>: Codable, Sendable {
    public let data: T
    public let metadata: ResponseMetadata
    
    public init(data: T, metadata: ResponseMetadata) {
        self.data = data
        self.metadata = metadata
    }
}

// MARK: - Batch Operations

/// Batch operation result
public struct BatchResult<T: Codable & Sendable>: Codable, Sendable {
    public let successful: [T]
    public let failed: [BatchFailure]
    
    public var allSucceeded: Bool {
        failed.isEmpty
    }
    
    public init(successful: [T], failed: [BatchFailure]) {
        self.successful = successful
        self.failed = failed
    }
}

/// Batch operation failure
public struct BatchFailure: Codable, Sendable {
    public let index: Int
    public let error: String
    public let code: String
    
    public init(index: Int, error: String, code: String) {
        self.index = index
        self.error = error
        self.code = code
    }
}

// MARK: - Result Extensions

extension Result where Success: Sendable, Failure: Error {
    /// Convert standard Result to APIResponse
    public func toAPIResponse<E: Error & Codable & Sendable>() -> APIResponse<Success, E> where Failure == E, Success: Codable {
        switch self {
        case .success(let value):
            return .success(value)
        case .failure(let error):
            return .failure(error)
        }
    }
}

// MARK: - Async Result Helpers

/// Helper for async operations that can fail
public func withResult<T: Sendable>(
    _ operation: @Sendable () async throws -> T
) async -> Result<T, Error> {
    do {
        let value = try await operation()
        return .success(value)
    } catch {
        return .failure(error)
    }
}

/// Helper for retrying operations
public func withRetry<T: Sendable>(
    maxAttempts: Int = 3,
    delay: TimeInterval = 1.0,
    shouldRetry: @Sendable (Error) -> Bool = { _ in true },
    operation: @Sendable () async throws -> T
) async throws -> T {
    var lastError: Error?
    
    for attempt in 1...maxAttempts {
        do {
            return try await operation()
        } catch {
            lastError = error
            
            if attempt < maxAttempts && shouldRetry(error) {
                let backoffDelay = delay * pow(2.0, Double(attempt - 1))
                try await Task.sleep(nanoseconds: UInt64(backoffDelay * 1_000_000_000))
            }
        }
    }
    
    throw lastError ?? ISLClientError.unknown
}
