import Foundation

// MARK: - API Client Configuration

/// Configuration for the API client
public struct APIClientConfiguration: Sendable {
    public let baseURL: URL
    public let timeout: TimeInterval
    public let encoder: JSONEncoder
    public let decoder: JSONDecoder
    public let interceptors: [any Interceptor]
    public let cachePolicy: CachePolicy
    public let session: URLSession
    
    public init(
        baseURL: URL,
        timeout: TimeInterval = 30,
        encoder: JSONEncoder? = nil,
        decoder: JSONDecoder? = nil,
        interceptors: [any Interceptor] = [],
        cachePolicy: CachePolicy = .networkOnly,
        session: URLSession? = nil
    ) {
        self.baseURL = baseURL
        self.timeout = timeout
        self.encoder = encoder ?? ISLDateCoding.encoder
        self.decoder = decoder ?? ISLDateCoding.decoder
        self.interceptors = interceptors
        self.cachePolicy = cachePolicy
        self.session = session ?? URLSession.shared
    }
}

// MARK: - API Client

/// HTTP API client with interceptor support
public actor APIClient {
    private let configuration: APIClientConfiguration
    private let cache: ResponseCache
    
    public init(configuration: APIClientConfiguration) {
        self.configuration = configuration
        self.cache = ResponseCache()
    }
    
    public init(
        baseURL: URL,
        interceptors: [any Interceptor] = []
    ) {
        self.configuration = APIClientConfiguration(
            baseURL: baseURL,
            interceptors: interceptors
        )
        self.cache = ResponseCache()
    }
    
    // MARK: - Request Methods
    
    /// Execute a request and decode the response
    public func request<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ endpoint: Endpoint<Body>
    ) async throws -> Response {
        let request = try endpoint.buildRequest(
            baseURL: configuration.baseURL,
            encoder: configuration.encoder
        )
        
        let cachePolicy = endpoint.cachePolicy ?? configuration.cachePolicy
        
        // Check cache first
        if cachePolicy.shouldCheckCache, let cached: Response = cache.get(for: request) {
            return cached
        }
        
        let (data, response) = try await executeWithInterceptors(request)
        
        try validateResponse(response)
        
        let decoded = try configuration.decoder.decode(Response.self, from: data)
        
        // Cache response if applicable
        if cachePolicy.shouldCache, let httpResponse = response as? HTTPURLResponse {
            cache.set(decoded, for: request, maxAge: cachePolicy.maxAge(from: httpResponse))
        }
        
        return decoded
    }
    
    /// Execute a request with typed error handling
    public func request<Body: Encodable & Sendable, Success: Decodable & Sendable, Failure: Error & Decodable & Sendable>(
        _ endpoint: Endpoint<Body>
    ) async throws -> APIResponse<Success, Failure> {
        let request = try endpoint.buildRequest(
            baseURL: configuration.baseURL,
            encoder: configuration.encoder
        )
        
        let (data, response) = try await executeWithInterceptors(request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ISLClientError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            let success = try configuration.decoder.decode(Success.self, from: data)
            return .success(success)
            
        case 400...499:
            // Try to decode as typed error first
            if let failure = try? configuration.decoder.decode(Failure.self, from: data) {
                return .failure(failure)
            }
            // Fall back to generic error
            throw mapHTTPError(statusCode: httpResponse.statusCode, response: try? configuration.decoder.decode(ErrorResponse.self, from: data))
            
        default:
            throw mapHTTPError(statusCode: httpResponse.statusCode, response: try? configuration.decoder.decode(ErrorResponse.self, from: data))
        }
    }
    
    /// Execute a request without expecting a response body
    public func requestVoid<Body: Encodable & Sendable>(
        _ endpoint: Endpoint<Body>
    ) async throws {
        let request = try endpoint.buildRequest(
            baseURL: configuration.baseURL,
            encoder: configuration.encoder
        )
        
        let (_, response) = try await executeWithInterceptors(request)
        
        try validateResponse(response)
    }
    
    /// Execute a raw request and return data
    public func requestData<Body: Encodable & Sendable>(
        _ endpoint: Endpoint<Body>
    ) async throws -> Data {
        let request = try endpoint.buildRequest(
            baseURL: configuration.baseURL,
            encoder: configuration.encoder
        )
        
        let (data, response) = try await executeWithInterceptors(request)
        
        try validateResponse(response)
        
        return data
    }
    
    // MARK: - Private Methods
    
    private func executeWithInterceptors(_ request: URLRequest) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        
        // Set default timeout
        if modifiedRequest.timeoutInterval == 0 {
            modifiedRequest.timeoutInterval = configuration.timeout
        }
        
        let chain = InterceptorChain(
            interceptors: configuration.interceptors,
            transport: { [configuration] req in
                try await configuration.session.data(for: req)
            }
        )
        
        return try await chain.execute(request: modifiedRequest)
    }
    
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ISLClientError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw ISLClientError.unauthorized
        case 403:
            throw ISLClientError.forbidden
        case 404:
            throw ISLClientError.notFound
        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap { TimeInterval($0) }
            throw ISLClientError.rateLimited(retryAfter: retryAfter)
        case 500...599:
            throw ISLClientError.serverError(statusCode: httpResponse.statusCode)
        default:
            throw ISLClientError.httpError(statusCode: httpResponse.statusCode, message: nil)
        }
    }
}

// MARK: - Response Cache

/// Simple in-memory response cache
private actor ResponseCache {
    private struct CacheEntry {
        let data: Any
        let expiration: Date
    }
    
    private var cache: [String: CacheEntry] = [:]
    
    func get<T>(for request: URLRequest) -> T? {
        let key = cacheKey(for: request)
        guard let entry = cache[key] else { return nil }
        
        if Date() > entry.expiration {
            cache.removeValue(forKey: key)
            return nil
        }
        
        return entry.data as? T
    }
    
    func set<T>(_ value: T, for request: URLRequest, maxAge: TimeInterval?) {
        let key = cacheKey(for: request)
        let expiration = Date().addingTimeInterval(maxAge ?? 300)
        cache[key] = CacheEntry(data: value, expiration: expiration)
    }
    
    func clear() {
        cache.removeAll()
    }
    
    private func cacheKey(for request: URLRequest) -> String {
        "\(request.httpMethod ?? "GET"):\(request.url?.absoluteString ?? "")"
    }
}

// MARK: - Cache Policy

/// Cache policy for API requests
public enum CachePolicy: Sendable {
    /// Only use network, don't cache
    case networkOnly
    /// Check cache first, then network
    case cacheFirst(maxAge: TimeInterval)
    /// Use cache if available, refresh in background
    case staleWhileRevalidate(maxAge: TimeInterval, staleAge: TimeInterval)
    /// Only use cache, don't make network request
    case cacheOnly
    
    var shouldCheckCache: Bool {
        switch self {
        case .networkOnly:
            return false
        case .cacheFirst, .staleWhileRevalidate, .cacheOnly:
            return true
        }
    }
    
    var shouldCache: Bool {
        switch self {
        case .networkOnly, .cacheOnly:
            return false
        case .cacheFirst, .staleWhileRevalidate:
            return true
        }
    }
    
    func maxAge(from response: HTTPURLResponse) -> TimeInterval? {
        switch self {
        case .networkOnly, .cacheOnly:
            return nil
        case .cacheFirst(let maxAge):
            return maxAge
        case .staleWhileRevalidate(let maxAge, _):
            return maxAge
        }
    }
}

// MARK: - Convenience Extensions

extension APIClient {
    /// Create a GET request
    public func get<Response: Decodable & Sendable>(
        _ path: String,
        queryItems: [URLQueryItem] = []
    ) async throws -> Response {
        try await request(Endpoint<EmptyBody>.get(path, queryItems: queryItems))
    }
    
    /// Create a POST request
    public func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(Endpoint.post(path, body: body))
    }
    
    /// Create a PUT request
    public func put<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(Endpoint.put(path, body: body))
    }
    
    /// Create a PATCH request
    public func patch<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(Endpoint.patch(path, body: body))
    }
    
    /// Create a DELETE request
    public func delete(_ path: String) async throws {
        try await requestVoid(Endpoint<EmptyBody>.delete(path))
    }
}
