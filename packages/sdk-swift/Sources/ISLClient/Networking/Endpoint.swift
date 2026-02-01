import Foundation

// MARK: - HTTP Method

/// HTTP methods supported by the API client
public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - Endpoint

/// API endpoint definition
public struct Endpoint<Body: Encodable & Sendable>: Sendable {
    public let path: String
    public let method: HTTPMethod
    public let body: Body?
    public let queryItems: [URLQueryItem]
    public let headers: [String: String]
    public let timeout: TimeInterval?
    public let cachePolicy: CachePolicy?
    
    public init(
        path: String,
        method: HTTPMethod = .get,
        body: Body? = nil,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:],
        timeout: TimeInterval? = nil,
        cachePolicy: CachePolicy? = nil
    ) {
        self.path = path
        self.method = method
        self.body = body
        self.queryItems = queryItems
        self.headers = headers
        self.timeout = timeout
        self.cachePolicy = cachePolicy
    }
}

// MARK: - Empty Body

/// Empty body for GET/DELETE requests
public struct EmptyBody: Encodable, Sendable {}

// MARK: - Endpoint Builder

/// Fluent endpoint builder
public final class EndpointBuilder<Body: Encodable & Sendable>: @unchecked Sendable {
    private var path: String
    private var method: HTTPMethod = .get
    private var body: Body?
    private var queryItems: [URLQueryItem] = []
    private var headers: [String: String] = [:]
    private var timeout: TimeInterval?
    private var cachePolicy: CachePolicy?
    
    public init(path: String) {
        self.path = path
    }
    
    @discardableResult
    public func method(_ method: HTTPMethod) -> Self {
        self.method = method
        return self
    }
    
    @discardableResult
    public func body(_ body: Body) -> Self {
        self.body = body
        return self
    }
    
    @discardableResult
    public func query(_ name: String, value: String?) -> Self {
        if let value = value {
            queryItems.append(URLQueryItem(name: name, value: value))
        }
        return self
    }
    
    @discardableResult
    public func query(_ items: [String: String?]) -> Self {
        for (name, value) in items {
            if let value = value {
                queryItems.append(URLQueryItem(name: name, value: value))
            }
        }
        return self
    }
    
    @discardableResult
    public func header(_ name: String, value: String) -> Self {
        headers[name] = value
        return self
    }
    
    @discardableResult
    public func headers(_ headers: [String: String]) -> Self {
        self.headers.merge(headers) { _, new in new }
        return self
    }
    
    @discardableResult
    public func timeout(_ timeout: TimeInterval) -> Self {
        self.timeout = timeout
        return self
    }
    
    @discardableResult
    public func cachePolicy(_ policy: CachePolicy) -> Self {
        self.cachePolicy = policy
        return self
    }
    
    public func build() -> Endpoint<Body> {
        Endpoint(
            path: path,
            method: method,
            body: body,
            queryItems: queryItems,
            headers: headers,
            timeout: timeout,
            cachePolicy: cachePolicy
        )
    }
}

// MARK: - Convenience Initializers

extension Endpoint where Body == EmptyBody {
    /// Create a GET endpoint
    public static func get(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) -> Endpoint<EmptyBody> {
        Endpoint(
            path: path,
            method: .get,
            body: nil,
            queryItems: queryItems,
            headers: headers
        )
    }
    
    /// Create a DELETE endpoint
    public static func delete(
        _ path: String,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:]
    ) -> Endpoint<EmptyBody> {
        Endpoint(
            path: path,
            method: .delete,
            body: nil,
            queryItems: queryItems,
            headers: headers
        )
    }
}

extension Endpoint {
    /// Create a POST endpoint
    public static func post<T: Encodable & Sendable>(
        _ path: String,
        body: T,
        headers: [String: String] = [:]
    ) -> Endpoint<T> {
        Endpoint<T>(
            path: path,
            method: .post,
            body: body,
            queryItems: [],
            headers: headers
        )
    }
    
    /// Create a PUT endpoint
    public static func put<T: Encodable & Sendable>(
        _ path: String,
        body: T,
        headers: [String: String] = [:]
    ) -> Endpoint<T> {
        Endpoint<T>(
            path: path,
            method: .put,
            body: body,
            queryItems: [],
            headers: headers
        )
    }
    
    /// Create a PATCH endpoint
    public static func patch<T: Encodable & Sendable>(
        _ path: String,
        body: T,
        headers: [String: String] = [:]
    ) -> Endpoint<T> {
        Endpoint<T>(
            path: path,
            method: .patch,
            body: body,
            queryItems: [],
            headers: headers
        )
    }
}

// MARK: - URL Building

extension Endpoint {
    /// Build URL from base URL
    public func buildURL(baseURL: URL) throws -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: true) else {
            throw ISLClientError.invalidURL
        }
        
        // Append path
        if components.path.hasSuffix("/") && path.hasPrefix("/") {
            components.path += String(path.dropFirst())
        } else if !components.path.hasSuffix("/") && !path.hasPrefix("/") {
            components.path += "/" + path
        } else {
            components.path += path
        }
        
        // Add query items
        if !queryItems.isEmpty {
            var existingItems = components.queryItems ?? []
            existingItems.append(contentsOf: queryItems)
            components.queryItems = existingItems
        }
        
        guard let url = components.url else {
            throw ISLClientError.invalidURL
        }
        
        return url
    }
    
    /// Build URLRequest
    public func buildRequest(baseURL: URL, encoder: JSONEncoder) throws -> URLRequest {
        let url = try buildURL(baseURL: baseURL)
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Set timeout if specified
        if let timeout = timeout {
            request.timeoutInterval = timeout
        }
        
        // Set headers
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        
        // Encode body
        if let body = body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(body)
        }
        
        return request
    }
}

// MARK: - Common Endpoints

/// User API endpoints
public enum UserEndpoints {
    public static func create(input: CreateUserInput) -> Endpoint<CreateUserInput> {
        .post("/api/users", body: input)
    }
    
    public static func get(id: UUID) -> Endpoint<EmptyBody> {
        .get("/api/users/\(id.uuidString)")
    }
    
    public static func update(id: UUID, input: UpdateUserInput) -> Endpoint<UpdateUserInput> {
        .patch("/api/users/\(id.uuidString)", body: input)
    }
    
    public static func delete(id: UUID) -> Endpoint<EmptyBody> {
        .delete("/api/users/\(id.uuidString)")
    }
    
    public static func list(pagination: PaginationInput) -> Endpoint<EmptyBody> {
        .get("/api/users", queryItems: [
            URLQueryItem(name: "page", value: String(pagination.page)),
            URLQueryItem(name: "pageSize", value: String(pagination.pageSize))
        ])
    }
}

/// Organization API endpoints
public enum OrganizationEndpoints {
    public static func create(input: CreateOrganizationInput) -> Endpoint<CreateOrganizationInput> {
        .post("/api/organizations", body: input)
    }
    
    public static func get(id: UUID) -> Endpoint<EmptyBody> {
        .get("/api/organizations/\(id.uuidString)")
    }
    
    public static func getBySlug(slug: String) -> Endpoint<EmptyBody> {
        .get("/api/organizations/by-slug/\(slug)")
    }
}

/// API Key endpoints
public enum APIKeyEndpoints {
    public static func create(input: CreateAPIKeyInput) -> Endpoint<CreateAPIKeyInput> {
        .post("/api/keys", body: input)
    }
    
    public static func list() -> Endpoint<EmptyBody> {
        .get("/api/keys")
    }
    
    public static func revoke(id: UUID) -> Endpoint<EmptyBody> {
        .delete("/api/keys/\(id.uuidString)")
    }
}
