import Foundation

// MARK: - Cache Protocol

/// Protocol for cache implementations
public protocol CacheProtocol: Actor {
    associatedtype Key: Hashable & Sendable
    associatedtype Value: Sendable
    
    func get(_ key: Key) async -> Value?
    func set(_ key: Key, value: Value, ttl: TimeInterval?) async
    func remove(_ key: Key) async
    func clear() async
    func contains(_ key: Key) async -> Bool
}

// MARK: - Memory Cache

/// Thread-safe in-memory cache with TTL support
public actor MemoryCache<Key: Hashable & Sendable, Value: Sendable>: CacheProtocol {
    private struct Entry {
        let value: Value
        let expiration: Date?
        
        var isExpired: Bool {
            guard let expiration = expiration else { return false }
            return Date() > expiration
        }
    }
    
    private var storage: [Key: Entry] = [:]
    private let maxSize: Int
    private var accessOrder: [Key] = []
    
    public init(maxSize: Int = 100) {
        self.maxSize = maxSize
    }
    
    public func get(_ key: Key) -> Value? {
        guard let entry = storage[key] else { return nil }
        
        if entry.isExpired {
            storage.removeValue(forKey: key)
            accessOrder.removeAll { $0 == key }
            return nil
        }
        
        // Update access order (LRU)
        accessOrder.removeAll { $0 == key }
        accessOrder.append(key)
        
        return entry.value
    }
    
    public func set(_ key: Key, value: Value, ttl: TimeInterval? = nil) {
        let expiration = ttl.map { Date().addingTimeInterval($0) }
        storage[key] = Entry(value: value, expiration: expiration)
        
        // Update access order
        accessOrder.removeAll { $0 == key }
        accessOrder.append(key)
        
        // Evict if over capacity
        while storage.count > maxSize, let oldest = accessOrder.first {
            storage.removeValue(forKey: oldest)
            accessOrder.removeFirst()
        }
    }
    
    public func remove(_ key: Key) {
        storage.removeValue(forKey: key)
        accessOrder.removeAll { $0 == key }
    }
    
    public func clear() {
        storage.removeAll()
        accessOrder.removeAll()
    }
    
    public func contains(_ key: Key) -> Bool {
        guard let entry = storage[key] else { return false }
        return !entry.isExpired
    }
    
    /// Remove expired entries
    public func evictExpired() {
        let expiredKeys = storage.filter { $0.value.isExpired }.map { $0.key }
        for key in expiredKeys {
            storage.removeValue(forKey: key)
            accessOrder.removeAll { $0 == key }
        }
    }
    
    /// Current cache size
    public var count: Int {
        storage.count
    }
}

// MARK: - Response Cache

/// Cache for API responses
public actor APIResponseCache {
    private let cache: MemoryCache<String, CachedResponse>
    private let defaultTTL: TimeInterval
    
    public struct CachedResponse: Sendable {
        public let data: Data
        public let statusCode: Int
        public let headers: [String: String]
        public let timestamp: Date
        
        public init(data: Data, statusCode: Int, headers: [String: String]) {
            self.data = data
            self.statusCode = statusCode
            self.headers = headers
            self.timestamp = Date()
        }
    }
    
    public init(maxSize: Int = 100, defaultTTL: TimeInterval = 300) {
        self.cache = MemoryCache(maxSize: maxSize)
        self.defaultTTL = defaultTTL
    }
    
    /// Generate cache key from request
    public func cacheKey(for request: URLRequest) -> String {
        let method = request.httpMethod ?? "GET"
        let url = request.url?.absoluteString ?? ""
        let body = request.httpBody.map { $0.base64EncodedString() } ?? ""
        return "\(method):\(url):\(body.prefix(100))"
    }
    
    /// Get cached response
    public func get(for request: URLRequest) async -> CachedResponse? {
        let key = cacheKey(for: request)
        return await cache.get(key)
    }
    
    /// Cache a response
    public func set(_ response: CachedResponse, for request: URLRequest, ttl: TimeInterval? = nil) async {
        let key = cacheKey(for: request)
        await cache.set(key, value: response, ttl: ttl ?? defaultTTL)
    }
    
    /// Remove cached response
    public func remove(for request: URLRequest) async {
        let key = cacheKey(for: request)
        await cache.remove(key)
    }
    
    /// Clear all cached responses
    public func clear() async {
        await cache.clear()
    }
    
    /// Decode cached response
    public func decode<T: Decodable>(_ type: T.Type, for request: URLRequest, decoder: JSONDecoder = ISLDateCoding.decoder) async throws -> T? {
        guard let cached = await get(for: request) else { return nil }
        return try decoder.decode(T.self, from: cached.data)
    }
}

// MARK: - Entity Cache

/// Cache for individual entities by ID
public actor EntityCache<Entity: Identifiable & Codable & Sendable> where Entity.ID: Hashable & Sendable {
    private let cache: MemoryCache<Entity.ID, Entity>
    private let ttl: TimeInterval
    
    public init(maxSize: Int = 500, ttl: TimeInterval = 300) {
        self.cache = MemoryCache(maxSize: maxSize)
        self.ttl = ttl
    }
    
    /// Get entity by ID
    public func get(_ id: Entity.ID) async -> Entity? {
        await cache.get(id)
    }
    
    /// Cache an entity
    public func set(_ entity: Entity) async {
        await cache.set(entity.id, value: entity, ttl: ttl)
    }
    
    /// Cache multiple entities
    public func setAll(_ entities: [Entity]) async {
        for entity in entities {
            await cache.set(entity.id, value: entity, ttl: ttl)
        }
    }
    
    /// Remove entity by ID
    public func remove(_ id: Entity.ID) async {
        await cache.remove(id)
    }
    
    /// Clear all entities
    public func clear() async {
        await cache.clear()
    }
    
    /// Check if entity exists
    public func contains(_ id: Entity.ID) async -> Bool {
        await cache.contains(id)
    }
}

// MARK: - Cache Manager

/// Central cache manager for the SDK
public actor CacheManager {
    public static let shared = CacheManager()
    
    private let responseCache: APIResponseCache
    private var entityCaches: [String: Any] = [:]
    
    public init(responseCacheSize: Int = 100, defaultTTL: TimeInterval = 300) {
        self.responseCache = APIResponseCache(maxSize: responseCacheSize, defaultTTL: defaultTTL)
    }
    
    /// Get response cache
    public var responses: APIResponseCache {
        responseCache
    }
    
    /// Get or create entity cache for a type
    public func entityCache<Entity: Identifiable & Codable & Sendable>(
        for type: Entity.Type
    ) -> EntityCache<Entity> where Entity.ID: Hashable & Sendable {
        let key = String(describing: type)
        if let existing = entityCaches[key] as? EntityCache<Entity> {
            return existing
        }
        let cache = EntityCache<Entity>()
        entityCaches[key] = cache
        return cache
    }
    
    /// Clear all caches
    public func clearAll() async {
        await responseCache.clear()
        for (_, cache) in entityCaches {
            if let userCache = cache as? EntityCache<User> {
                await userCache.clear()
            }
            if let orgCache = cache as? EntityCache<Organization> {
                await orgCache.clear()
            }
        }
    }
}

// MARK: - Cache Configuration

/// Cache configuration options
public struct CacheConfiguration: Sendable {
    public let enabled: Bool
    public let maxResponseSize: Int
    public let maxEntitySize: Int
    public let defaultTTL: TimeInterval
    public let respectCacheHeaders: Bool
    
    public init(
        enabled: Bool = true,
        maxResponseSize: Int = 100,
        maxEntitySize: Int = 500,
        defaultTTL: TimeInterval = 300,
        respectCacheHeaders: Bool = true
    ) {
        self.enabled = enabled
        self.maxResponseSize = maxResponseSize
        self.maxEntitySize = maxEntitySize
        self.defaultTTL = defaultTTL
        self.respectCacheHeaders = respectCacheHeaders
    }
    
    public static let `default` = CacheConfiguration()
    
    public static let disabled = CacheConfiguration(enabled: false)
    
    public static let aggressive = CacheConfiguration(
        enabled: true,
        maxResponseSize: 500,
        maxEntitySize: 2000,
        defaultTTL: 600
    )
}

// MARK: - Cache Headers Parsing

/// Parse cache control headers
public struct CacheControlHeader: Sendable {
    public let maxAge: TimeInterval?
    public let noCache: Bool
    public let noStore: Bool
    public let mustRevalidate: Bool
    public let isPrivate: Bool
    public let isPublic: Bool
    
    public init(from header: String?) {
        guard let header = header else {
            self.maxAge = nil
            self.noCache = false
            self.noStore = false
            self.mustRevalidate = false
            self.isPrivate = false
            self.isPublic = false
            return
        }
        
        let directives = header.lowercased().split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        
        var maxAge: TimeInterval?
        for directive in directives {
            if directive.hasPrefix("max-age=") {
                let value = directive.dropFirst(8)
                maxAge = TimeInterval(value)
            }
        }
        
        self.maxAge = maxAge
        self.noCache = directives.contains("no-cache")
        self.noStore = directives.contains("no-store")
        self.mustRevalidate = directives.contains("must-revalidate")
        self.isPrivate = directives.contains("private")
        self.isPublic = directives.contains("public")
    }
    
    public var isCacheable: Bool {
        !noCache && !noStore
    }
}
