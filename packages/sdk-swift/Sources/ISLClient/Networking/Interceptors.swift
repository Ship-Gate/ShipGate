import Foundation
import os.log

// MARK: - Interceptor Protocol

/// Request/response interceptor protocol
public protocol Interceptor: Sendable {
    /// Intercept a request and optionally modify it
    func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse)
}

// MARK: - Interceptor Chain

/// Chain of interceptors
public struct InterceptorChain: Sendable {
    private let interceptors: [any Interceptor]
    private let transport: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    
    public init(
        interceptors: [any Interceptor],
        transport: @escaping @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) {
        self.interceptors = interceptors
        self.transport = transport
    }
    
    public func execute(request: URLRequest) async throws -> (Data, URLResponse) {
        if interceptors.isEmpty {
            return try await transport(request)
        }
        
        func buildChain(index: Int) -> @Sendable (URLRequest) async throws -> (Data, URLResponse) {
            if index >= interceptors.count {
                return transport
            }
            
            return { req in
                try await self.interceptors[index].intercept(
                    request: req,
                    next: buildChain(index: index + 1)
                )
            }
        }
        
        return try await buildChain(index: 0)(request)
    }
}

// MARK: - Auth Interceptor

/// Authentication interceptor
public final class AuthInterceptor: Interceptor, @unchecked Sendable {
    private let tokenProvider: @Sendable () async throws -> String?
    private let headerName: String
    private let tokenPrefix: String
    
    public init(
        token: String?,
        headerName: String = "Authorization",
        tokenPrefix: String = "Bearer "
    ) {
        self.tokenProvider = { token }
        self.headerName = headerName
        self.tokenPrefix = tokenPrefix
    }
    
    public init(
        tokenProvider: @escaping @Sendable () async throws -> String?,
        headerName: String = "Authorization",
        tokenPrefix: String = "Bearer "
    ) {
        self.tokenProvider = tokenProvider
        self.headerName = headerName
        self.tokenPrefix = tokenPrefix
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        
        if let token = try await tokenProvider() {
            modifiedRequest.setValue(tokenPrefix + token, forHTTPHeaderField: headerName)
        }
        
        return try await next(modifiedRequest)
    }
}

// MARK: - API Key Interceptor

/// API Key authentication interceptor
public final class APIKeyInterceptor: Interceptor, @unchecked Sendable {
    private let apiKey: String
    private let headerName: String
    
    public init(apiKey: String, headerName: String = "X-API-Key") {
        self.apiKey = apiKey
        self.headerName = headerName
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        modifiedRequest.setValue(apiKey, forHTTPHeaderField: headerName)
        return try await next(modifiedRequest)
    }
}

// MARK: - Logging Interceptor

/// Logging level
public enum LoggingLevel: Int, Sendable, Comparable {
    case none = 0
    case basic = 1
    case headers = 2
    case body = 3
    case debug = 4
    
    public static func < (lhs: LoggingLevel, rhs: LoggingLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

/// Request/response logging interceptor
public final class LoggingInterceptor: Interceptor, @unchecked Sendable {
    private let level: LoggingLevel
    private let logger: Logger
    private let redactHeaders: Set<String>
    
    public init(
        level: LoggingLevel = .basic,
        subsystem: String = "com.intentos.islclient",
        category: String = "networking",
        redactHeaders: Set<String> = ["Authorization", "X-API-Key"]
    ) {
        self.level = level
        self.logger = Logger(subsystem: subsystem, category: category)
        self.redactHeaders = redactHeaders
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        guard level != .none else {
            return try await next(request)
        }
        
        let requestId = UUID().uuidString.prefix(8)
        let startTime = CFAbsoluteTimeGetCurrent()
        
        logRequest(request, id: String(requestId))
        
        do {
            let (data, response) = try await next(request)
            let elapsed = CFAbsoluteTimeGetCurrent() - startTime
            logResponse(response, data: data, elapsed: elapsed, id: String(requestId))
            return (data, response)
        } catch {
            let elapsed = CFAbsoluteTimeGetCurrent() - startTime
            logError(error, elapsed: elapsed, id: String(requestId))
            throw error
        }
    }
    
    private func logRequest(_ request: URLRequest, id: String) {
        let method = request.httpMethod ?? "UNKNOWN"
        let url = request.url?.absoluteString ?? "unknown"
        
        if level >= .basic {
            logger.info("[\(id)] → \(method) \(url)")
        }
        
        if level >= .headers, let headers = request.allHTTPHeaderFields {
            for (name, value) in headers {
                let logValue = redactHeaders.contains(name) ? "[REDACTED]" : value
                logger.debug("[\(id)]   \(name): \(logValue)")
            }
        }
        
        if level >= .body, let body = request.httpBody, let bodyString = String(data: body, encoding: .utf8) {
            let truncated = bodyString.prefix(1000)
            logger.debug("[\(id)]   Body: \(truncated)")
        }
    }
    
    private func logResponse(_ response: URLResponse, data: Data, elapsed: TimeInterval, id: String) {
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.warning("[\(id)] ← Non-HTTP response")
            return
        }
        
        let status = httpResponse.statusCode
        let elapsedMs = Int(elapsed * 1000)
        
        if level >= .basic {
            logger.info("[\(id)] ← \(status) (\(elapsedMs)ms)")
        }
        
        if level >= .headers {
            for (name, value) in httpResponse.allHeaderFields {
                logger.debug("[\(id)]   \(name): \(value)")
            }
        }
        
        if level >= .body, let bodyString = String(data: data, encoding: .utf8) {
            let truncated = bodyString.prefix(1000)
            logger.debug("[\(id)]   Body: \(truncated)")
        }
    }
    
    private func logError(_ error: Error, elapsed: TimeInterval, id: String) {
        let elapsedMs = Int(elapsed * 1000)
        logger.error("[\(id)] ✗ Error: \(error.localizedDescription) (\(elapsedMs)ms)")
    }
}

// MARK: - Retry Interceptor

/// Retry policy configuration
public struct RetryPolicy: Sendable {
    public let maxRetries: Int
    public let baseDelay: TimeInterval
    public let maxDelay: TimeInterval
    public let retryableStatusCodes: Set<Int>
    public let exponentialBackoff: Bool
    
    public init(
        maxRetries: Int = 3,
        baseDelay: TimeInterval = 1.0,
        maxDelay: TimeInterval = 30.0,
        retryableStatusCodes: Set<Int> = [408, 429, 500, 502, 503, 504],
        exponentialBackoff: Bool = true
    ) {
        self.maxRetries = maxRetries
        self.baseDelay = baseDelay
        self.maxDelay = maxDelay
        self.retryableStatusCodes = retryableStatusCodes
        self.exponentialBackoff = exponentialBackoff
    }
    
    public static let `default` = RetryPolicy()
    
    public static func exponentialBackoff(maxRetries: Int) -> RetryPolicy {
        RetryPolicy(maxRetries: maxRetries, exponentialBackoff: true)
    }
    
    public static func fixedDelay(_ delay: TimeInterval, maxRetries: Int) -> RetryPolicy {
        RetryPolicy(maxRetries: maxRetries, baseDelay: delay, exponentialBackoff: false)
    }
}

/// Automatic retry interceptor
public final class RetryInterceptor: Interceptor, @unchecked Sendable {
    private let policy: RetryPolicy
    private let logger: Logger
    
    public init(policy: RetryPolicy = .default) {
        self.policy = policy
        self.logger = Logger(subsystem: "com.intentos.islclient", category: "retry")
    }
    
    public init(maxRetries: Int) {
        self.policy = RetryPolicy(maxRetries: maxRetries)
        self.logger = Logger(subsystem: "com.intentos.islclient", category: "retry")
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var lastError: Error?
        
        for attempt in 0...policy.maxRetries {
            do {
                let (data, response) = try await next(request)
                
                // Check if we should retry based on status code
                if let httpResponse = response as? HTTPURLResponse,
                   policy.retryableStatusCodes.contains(httpResponse.statusCode),
                   attempt < policy.maxRetries {
                    
                    let delay = calculateDelay(attempt: attempt, response: httpResponse)
                    logger.info("Retrying after \(Int(delay * 1000))ms (attempt \(attempt + 1)/\(self.policy.maxRetries))")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    continue
                }
                
                return (data, response)
            } catch {
                lastError = error
                
                if shouldRetry(error: error, attempt: attempt) {
                    let delay = calculateDelay(attempt: attempt, response: nil)
                    logger.info("Retrying after error: \(error.localizedDescription) (attempt \(attempt + 1)/\(self.policy.maxRetries))")
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                    continue
                }
                
                throw error
            }
        }
        
        throw lastError ?? ISLClientError.unknown
    }
    
    private func shouldRetry(error: Error, attempt: Int) -> Bool {
        guard attempt < policy.maxRetries else { return false }
        
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .networkConnectionLost, .notConnectedToInternet:
                return true
            default:
                return false
            }
        }
        
        if let clientError = error as? ISLClientError {
            return clientError.isRetryable
        }
        
        return false
    }
    
    private func calculateDelay(attempt: Int, response: HTTPURLResponse?) -> TimeInterval {
        // Check for Retry-After header
        if let retryAfter = response?.value(forHTTPHeaderField: "Retry-After"),
           let seconds = TimeInterval(retryAfter) {
            return min(seconds, policy.maxDelay)
        }
        
        if policy.exponentialBackoff {
            let delay = policy.baseDelay * pow(2.0, Double(attempt))
            // Add jitter (±25%)
            let jitter = delay * Double.random(in: -0.25...0.25)
            return min(delay + jitter, policy.maxDelay)
        }
        
        return policy.baseDelay
    }
}

// MARK: - Headers Interceptor

/// Static headers interceptor
public final class HeadersInterceptor: Interceptor, @unchecked Sendable {
    private let headers: [String: String]
    
    public init(headers: [String: String]) {
        self.headers = headers
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        for (name, value) in headers {
            modifiedRequest.setValue(value, forHTTPHeaderField: name)
        }
        return try await next(modifiedRequest)
    }
}

// MARK: - Metrics Interceptor

/// Request metrics collection
public struct RequestMetrics: Sendable {
    public let url: String
    public let method: String
    public let statusCode: Int?
    public let duration: TimeInterval
    public let requestSize: Int
    public let responseSize: Int
    public let error: String?
    public let timestamp: Date
}

/// Metrics callback type
public typealias MetricsCallback = @Sendable (RequestMetrics) -> Void

/// Metrics collection interceptor
public final class MetricsInterceptor: Interceptor, @unchecked Sendable {
    private let callback: MetricsCallback
    
    public init(callback: @escaping MetricsCallback) {
        self.callback = callback
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        let startTime = CFAbsoluteTimeGetCurrent()
        let requestSize = request.httpBody?.count ?? 0
        
        do {
            let (data, response) = try await next(request)
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            
            let metrics = RequestMetrics(
                url: request.url?.absoluteString ?? "",
                method: request.httpMethod ?? "UNKNOWN",
                statusCode: (response as? HTTPURLResponse)?.statusCode,
                duration: duration,
                requestSize: requestSize,
                responseSize: data.count,
                error: nil,
                timestamp: Date()
            )
            callback(metrics)
            
            return (data, response)
        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            
            let metrics = RequestMetrics(
                url: request.url?.absoluteString ?? "",
                method: request.httpMethod ?? "UNKNOWN",
                statusCode: nil,
                duration: duration,
                requestSize: requestSize,
                responseSize: 0,
                error: error.localizedDescription,
                timestamp: Date()
            )
            callback(metrics)
            
            throw error
        }
    }
}

// MARK: - Request ID Interceptor

/// Adds unique request ID header
public final class RequestIDInterceptor: Interceptor, @unchecked Sendable {
    private let headerName: String
    
    public init(headerName: String = "X-Request-ID") {
        self.headerName = headerName
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        modifiedRequest.setValue(UUID().uuidString, forHTTPHeaderField: headerName)
        return try await next(modifiedRequest)
    }
}

// MARK: - User Agent Interceptor

/// Sets User-Agent header
public final class UserAgentInterceptor: Interceptor, @unchecked Sendable {
    private let userAgent: String
    
    public init(
        appName: String = "ISLClient",
        appVersion: String = "1.0.0"
    ) {
        #if os(iOS)
        let platform = "iOS"
        #elseif os(macOS)
        let platform = "macOS"
        #elseif os(watchOS)
        let platform = "watchOS"
        #elseif os(tvOS)
        let platform = "tvOS"
        #else
        let platform = "Unknown"
        #endif
        
        self.userAgent = "\(appName)/\(appVersion) (\(platform))"
    }
    
    public init(userAgent: String) {
        self.userAgent = userAgent
    }
    
    public func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse) {
        var modifiedRequest = request
        modifiedRequest.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        return try await next(modifiedRequest)
    }
}
