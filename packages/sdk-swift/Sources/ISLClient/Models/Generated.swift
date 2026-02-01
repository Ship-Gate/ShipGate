import Foundation

// MARK: - Value Types (Generated from ISL)

/// Email value type with built-in validation
/// Generated from ISL: `type Email = String @email @max_length(254)`
public struct Email: Codable, Equatable, Hashable, Sendable {
    public let value: String
    
    public init(_ value: String) throws {
        guard !value.isEmpty else {
            throw ValidationError.emptyValue(field: "email")
        }
        guard value.contains("@") else {
            throw ValidationError.invalidEmail
        }
        guard value.count <= 254 else {
            throw ValidationError.emailTooLong
        }
        // Basic email format validation
        let emailRegex = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        guard value.range(of: emailRegex, options: .regularExpression) != nil else {
            throw ValidationError.invalidEmailFormat
        }
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        try self.init(rawValue)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

/// Username value type with validation
/// Generated from ISL: `type Username = String @min_length(3) @max_length(30) @pattern("[a-zA-Z0-9_]+")`
public struct Username: Codable, Equatable, Hashable, Sendable {
    public let value: String
    
    public init(_ value: String) throws {
        guard value.count >= 3 else {
            throw ValidationError.usernameTooShort
        }
        guard value.count <= 30 else {
            throw ValidationError.usernameTooLong
        }
        let usernameRegex = #"^[a-zA-Z0-9_]+$"#
        guard value.range(of: usernameRegex, options: .regularExpression) != nil else {
            throw ValidationError.invalidUsernameFormat
        }
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        try self.init(rawValue)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

/// Phone number value type
/// Generated from ISL: `type PhoneNumber = String @pattern("^\+[1-9]\d{1,14}$")`
public struct PhoneNumber: Codable, Equatable, Hashable, Sendable {
    public let value: String
    
    public init(_ value: String) throws {
        let phoneRegex = #"^\+[1-9]\d{1,14}$"#
        guard value.range(of: phoneRegex, options: .regularExpression) != nil else {
            throw ValidationError.invalidPhoneNumber
        }
        self.value = value
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        try self.init(rawValue)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}

/// URL value type with validation
/// Generated from ISL: `type URL = String @url`
public struct ValidatedURL: Codable, Equatable, Hashable, Sendable {
    public let value: URL
    
    public init(_ string: String) throws {
        guard let url = URL(string: string) else {
            throw ValidationError.invalidURL
        }
        guard url.scheme == "http" || url.scheme == "https" else {
            throw ValidationError.invalidURLScheme
        }
        self.value = url
    }
    
    public init(_ url: URL) throws {
        guard url.scheme == "http" || url.scheme == "https" else {
            throw ValidationError.invalidURLScheme
        }
        self.value = url
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        try self.init(rawValue)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value.absoluteString)
    }
}

// MARK: - Enums (Generated from ISL)

/// User status enumeration
/// Generated from ISL: `enum UserStatus { PENDING, ACTIVE, SUSPENDED }`
public enum UserStatus: String, Codable, CaseIterable, Sendable {
    case pending = "PENDING"
    case active = "ACTIVE"
    case suspended = "SUSPENDED"
}

/// Permission level enumeration
/// Generated from ISL: `enum PermissionLevel { READ, WRITE, ADMIN }`
public enum PermissionLevel: String, Codable, CaseIterable, Sendable {
    case read = "READ"
    case write = "WRITE"
    case admin = "ADMIN"
}

/// Subscription tier enumeration
/// Generated from ISL: `enum SubscriptionTier { FREE, BASIC, PRO, ENTERPRISE }`
public enum SubscriptionTier: String, Codable, CaseIterable, Sendable {
    case free = "FREE"
    case basic = "BASIC"
    case pro = "PRO"
    case enterprise = "ENTERPRISE"
}

// MARK: - Entities (Generated from ISL)

/// User entity
/// Generated from ISL entity definition
public struct User: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let email: Email
    public let username: String
    public let displayName: String?
    public let status: UserStatus
    public let permissionLevel: PermissionLevel
    public let subscriptionTier: SubscriptionTier
    public let createdAt: Date
    public let updatedAt: Date
    
    public init(
        id: UUID,
        email: Email,
        username: String,
        displayName: String? = nil,
        status: UserStatus,
        permissionLevel: PermissionLevel = .read,
        subscriptionTier: SubscriptionTier = .free,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.email = email
        self.username = username
        self.displayName = displayName
        self.status = status
        self.permissionLevel = permissionLevel
        self.subscriptionTier = subscriptionTier
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// Organization entity
/// Generated from ISL entity definition
public struct Organization: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let slug: String
    public let ownerId: UUID
    public let subscriptionTier: SubscriptionTier
    public let memberCount: Int
    public let createdAt: Date
    public let updatedAt: Date
    
    public init(
        id: UUID,
        name: String,
        slug: String,
        ownerId: UUID,
        subscriptionTier: SubscriptionTier,
        memberCount: Int,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.name = name
        self.slug = slug
        self.ownerId = ownerId
        self.subscriptionTier = subscriptionTier
        self.memberCount = memberCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// API Key entity
/// Generated from ISL entity definition
public struct APIKey: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let name: String
    public let keyPrefix: String
    public let permissions: [PermissionLevel]
    public let expiresAt: Date?
    public let lastUsedAt: Date?
    public let createdAt: Date
    
    public init(
        id: UUID,
        name: String,
        keyPrefix: String,
        permissions: [PermissionLevel],
        expiresAt: Date? = nil,
        lastUsedAt: Date? = nil,
        createdAt: Date
    ) {
        self.id = id
        self.name = name
        self.keyPrefix = keyPrefix
        self.permissions = permissions
        self.expiresAt = expiresAt
        self.lastUsedAt = lastUsedAt
        self.createdAt = createdAt
    }
}

// MARK: - Behavior Inputs (Generated from ISL)

/// Create user input
/// Generated from ISL: `behavior CreateUser`
public struct CreateUserInput: Codable, Equatable, Sendable {
    public let email: Email
    public let username: String
    public let displayName: String?
    
    public init(email: Email, username: String, displayName: String? = nil) {
        self.email = email
        self.username = username
        self.displayName = displayName
    }
}

/// Update user input
/// Generated from ISL: `behavior UpdateUser`
public struct UpdateUserInput: Codable, Equatable, Sendable {
    public let displayName: String?
    public let status: UserStatus?
    
    public init(displayName: String? = nil, status: UserStatus? = nil) {
        self.displayName = displayName
        self.status = status
    }
}

/// Create organization input
/// Generated from ISL: `behavior CreateOrganization`
public struct CreateOrganizationInput: Codable, Equatable, Sendable {
    public let name: String
    public let slug: String
    
    public init(name: String, slug: String) {
        self.name = name
        self.slug = slug
    }
}

/// Create API key input
/// Generated from ISL: `behavior CreateAPIKey`
public struct CreateAPIKeyInput: Codable, Equatable, Sendable {
    public let name: String
    public let permissions: [PermissionLevel]
    public let expiresAt: Date?
    
    public init(name: String, permissions: [PermissionLevel], expiresAt: Date? = nil) {
        self.name = name
        self.permissions = permissions
        self.expiresAt = expiresAt
    }
}

// MARK: - Pagination

/// Paginated response wrapper
public struct PaginatedResponse<T: Codable & Sendable>: Codable, Sendable {
    public let items: [T]
    public let total: Int
    public let page: Int
    public let pageSize: Int
    public let hasMore: Bool
    
    public init(items: [T], total: Int, page: Int, pageSize: Int) {
        self.items = items
        self.total = total
        self.page = page
        self.pageSize = pageSize
        self.hasMore = (page * pageSize) < total
    }
}

/// Pagination input
public struct PaginationInput: Codable, Equatable, Sendable {
    public let page: Int
    public let pageSize: Int
    
    public init(page: Int = 1, pageSize: Int = 20) {
        self.page = max(1, page)
        self.pageSize = min(max(1, pageSize), 100)
    }
}

// MARK: - Sorting & Filtering

/// Sort order
public enum SortOrder: String, Codable, Sendable {
    case ascending = "ASC"
    case descending = "DESC"
}

/// Generic sort input
public struct SortInput<Field: RawRepresentable & Codable & Sendable>: Codable, Sendable where Field.RawValue == String {
    public let field: Field
    public let order: SortOrder
    
    public init(field: Field, order: SortOrder = .ascending) {
        self.field = field
        self.order = order
    }
}

/// User sort fields
public enum UserSortField: String, Codable, Sendable {
    case createdAt = "created_at"
    case updatedAt = "updated_at"
    case username = "username"
    case email = "email"
}

// MARK: - Date Coding Strategy

/// Custom date formatter for ISO8601 with fractional seconds
public enum ISLDateCoding {
    public static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }()
    
    public static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            if let date = formatter.date(from: dateString) {
                return date
            }
            
            // Fallback without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) {
                return date
            }
            
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid date format: \(dateString)"
            )
        }
        return decoder
    }()
}
