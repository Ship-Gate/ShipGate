import XCTest
@testable import ISLClient

final class ISLClientTests: XCTestCase {
    
    // MARK: - Email Tests
    
    func testValidEmail() throws {
        let email = try Email("test@example.com")
        XCTAssertEqual(email.value, "test@example.com")
    }
    
    func testInvalidEmailWithoutAt() {
        XCTAssertThrowsError(try Email("invalid")) { error in
            XCTAssertTrue(error is ValidationError)
        }
    }
    
    func testInvalidEmailFormat() {
        XCTAssertThrowsError(try Email("@invalid.com")) { error in
            XCTAssertTrue(error is ValidationError)
        }
    }
    
    func testEmailTooLong() {
        let longEmail = String(repeating: "a", count: 250) + "@test.com"
        XCTAssertThrowsError(try Email(longEmail)) { error in
            XCTAssertEqual(error as? ValidationError, .emailTooLong)
        }
    }
    
    func testEmailEquality() throws {
        let email1 = try Email("test@example.com")
        let email2 = try Email("test@example.com")
        XCTAssertEqual(email1, email2)
    }
    
    func testEmailCodable() throws {
        let email = try Email("test@example.com")
        let encoded = try JSONEncoder().encode(email)
        let decoded = try JSONDecoder().decode(Email.self, from: encoded)
        XCTAssertEqual(email, decoded)
    }
    
    // MARK: - Username Tests
    
    func testValidUsername() throws {
        let username = try Username("john_doe123")
        XCTAssertEqual(username.value, "john_doe123")
    }
    
    func testUsernameTooShort() {
        XCTAssertThrowsError(try Username("ab")) { error in
            XCTAssertEqual(error as? ValidationError, .usernameTooShort)
        }
    }
    
    func testUsernameTooLong() {
        let longUsername = String(repeating: "a", count: 31)
        XCTAssertThrowsError(try Username(longUsername)) { error in
            XCTAssertEqual(error as? ValidationError, .usernameTooLong)
        }
    }
    
    func testUsernameInvalidCharacters() {
        XCTAssertThrowsError(try Username("john@doe")) { error in
            XCTAssertEqual(error as? ValidationError, .invalidUsernameFormat)
        }
    }
    
    // MARK: - PhoneNumber Tests
    
    func testValidPhoneNumber() throws {
        let phone = try PhoneNumber("+1234567890")
        XCTAssertEqual(phone.value, "+1234567890")
    }
    
    func testInvalidPhoneNumber() {
        XCTAssertThrowsError(try PhoneNumber("1234567890")) { error in
            XCTAssertEqual(error as? ValidationError, .invalidPhoneNumber)
        }
    }
    
    // MARK: - Validator Tests
    
    func testLengthValidatorMinimum() {
        let validator = LengthValidator(field: "test", min: 3)
        XCTAssertNoThrow(try validator.validate("abc"))
        XCTAssertThrowsError(try validator.validate("ab"))
    }
    
    func testLengthValidatorMaximum() {
        let validator = LengthValidator(field: "test", max: 5)
        XCTAssertNoThrow(try validator.validate("abcde"))
        XCTAssertThrowsError(try validator.validate("abcdef"))
    }
    
    func testPatternValidator() {
        let validator = PatternValidator(field: "test", pattern: "^[a-z]+$")
        XCTAssertNoThrow(try validator.validate("abc"))
        XCTAssertThrowsError(try validator.validate("ABC"))
        XCTAssertThrowsError(try validator.validate("abc123"))
    }
    
    func testNonEmptyValidator() {
        let validator = NonEmptyValidator(field: "test")
        XCTAssertNoThrow(try validator.validate("a"))
        XCTAssertThrowsError(try validator.validate(""))
    }
    
    func testCreateUserValidator() throws {
        let validator = CreateUserValidator()
        let email = try Email("test@example.com")
        
        // Valid input
        let validInput = CreateUserInput(email: email, username: "validuser")
        XCTAssertNoThrow(try validator.validate(validInput))
        
        // Invalid username - too short
        let shortUsernameInput = CreateUserInput(email: email, username: "ab")
        XCTAssertThrowsError(try validator.validate(shortUsernameInput))
        
        // Invalid username - too long
        let longUsernameInput = CreateUserInput(email: email, username: String(repeating: "a", count: 31))
        XCTAssertThrowsError(try validator.validate(longUsernameInput))
    }
    
    // MARK: - User Entity Tests
    
    func testUserCreation() throws {
        let email = try Email("test@example.com")
        let user = User(
            id: UUID(),
            email: email,
            username: "testuser",
            displayName: "Test User",
            status: .pending,
            permissionLevel: .read,
            subscriptionTier: .free,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        XCTAssertEqual(user.email.value, "test@example.com")
        XCTAssertEqual(user.username, "testuser")
        XCTAssertEqual(user.status, .pending)
    }
    
    func testUserCodable() throws {
        let email = try Email("test@example.com")
        let user = User(
            id: UUID(),
            email: email,
            username: "testuser",
            displayName: nil,
            status: .active,
            permissionLevel: .write,
            subscriptionTier: .pro,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        let encoder = ISLDateCoding.encoder
        let decoder = ISLDateCoding.decoder
        
        let encoded = try encoder.encode(user)
        let decoded = try decoder.decode(User.self, from: encoded)
        
        XCTAssertEqual(user.id, decoded.id)
        XCTAssertEqual(user.email, decoded.email)
        XCTAssertEqual(user.username, decoded.username)
        XCTAssertEqual(user.status, decoded.status)
    }
    
    // MARK: - Endpoint Tests
    
    func testEndpointBuilding() throws {
        let baseURL = URL(string: "https://api.example.com")!
        let endpoint = Endpoint<EmptyBody>.get("/users", queryItems: [
            URLQueryItem(name: "page", value: "1"),
            URLQueryItem(name: "limit", value: "10")
        ])
        
        let url = try endpoint.buildURL(baseURL: baseURL)
        XCTAssertEqual(url.absoluteString, "https://api.example.com/users?page=1&limit=10")
    }
    
    func testPostEndpoint() throws {
        let email = try Email("test@example.com")
        let input = CreateUserInput(email: email, username: "testuser")
        let endpoint = Endpoint.post("/users", body: input)
        
        XCTAssertEqual(endpoint.method, .post)
        XCTAssertEqual(endpoint.path, "/users")
        XCTAssertNotNil(endpoint.body)
    }
    
    func testEndpointBuilder() throws {
        let builder = EndpointBuilder<CreateUserInput>(path: "/users")
            .method(.post)
            .header("X-Custom", value: "test")
            .timeout(60)
        
        let endpoint = builder.build()
        
        XCTAssertEqual(endpoint.path, "/users")
        XCTAssertEqual(endpoint.method, .post)
        XCTAssertEqual(endpoint.headers["X-Custom"], "test")
        XCTAssertEqual(endpoint.timeout, 60)
    }
    
    // MARK: - Cache Tests
    
    func testMemoryCache() async {
        let cache = MemoryCache<String, Int>(maxSize: 3)
        
        await cache.set("a", value: 1, ttl: nil)
        await cache.set("b", value: 2, ttl: nil)
        await cache.set("c", value: 3, ttl: nil)
        
        let a = await cache.get("a")
        XCTAssertEqual(a, 1)
        
        // Test eviction
        await cache.set("d", value: 4, ttl: nil)
        // "b" should be evicted (LRU - "a" was accessed)
        let count = await cache.count
        XCTAssertEqual(count, 3)
    }
    
    func testCacheExpiration() async throws {
        let cache = MemoryCache<String, Int>(maxSize: 10)
        
        // Set with very short TTL
        await cache.set("key", value: 42, ttl: 0.01) // 10ms TTL
        
        // Should exist immediately
        var value = await cache.get("key")
        XCTAssertEqual(value, 42)
        
        // Wait for expiration
        try await Task.sleep(nanoseconds: 20_000_000) // 20ms
        
        // Should be expired
        value = await cache.get("key")
        XCTAssertNil(value)
    }
    
    // MARK: - API Response Tests
    
    func testAPIResponseSuccess() {
        let response: APIResponse<String, CreateUserError> = .success("test")
        
        XCTAssertEqual(response.value, "test")
        XCTAssertNil(response.error)
        XCTAssertNoThrow(try response.get())
    }
    
    func testAPIResponseFailure() {
        let response: APIResponse<String, CreateUserError> = .failure(.duplicateEmail)
        
        XCTAssertNil(response.value)
        XCTAssertEqual(response.error, .duplicateEmail)
        XCTAssertThrowsError(try response.get())
    }
    
    func testAPIResponseMap() {
        let response: APIResponse<Int, CreateUserError> = .success(42)
        let mapped = response.map { String($0) }
        
        XCTAssertEqual(mapped.value, "42")
    }
    
    // MARK: - Pagination Tests
    
    func testPaginationInput() {
        let pagination = PaginationInput(page: 0, pageSize: 200)
        
        // Should clamp to valid values
        XCTAssertEqual(pagination.page, 1) // Min 1
        XCTAssertEqual(pagination.pageSize, 100) // Max 100
    }
    
    func testPaginatedResponse() {
        let response = PaginatedResponse(
            items: [1, 2, 3],
            total: 10,
            page: 1,
            pageSize: 3
        )
        
        XCTAssertTrue(response.hasMore)
        XCTAssertEqual(response.items.count, 3)
    }
    
    // MARK: - Error Tests
    
    func testValidationErrorMessages() {
        let error = ValidationError.usernameTooShort
        XCTAssertEqual(error.errorDescription, "Username must be at least 3 characters")
    }
    
    func testCreateUserErrorMessages() {
        let error = CreateUserError.rateLimited(retryAfter: 30)
        XCTAssertTrue(error.errorDescription?.contains("30") ?? false)
    }
    
    func testISLClientErrorRetryable() {
        XCTAssertTrue(ISLClientError.timeout.isRetryable)
        XCTAssertTrue(ISLClientError.serverError(statusCode: 500).isRetryable)
        XCTAssertFalse(ISLClientError.unauthorized.isRetryable)
        XCTAssertFalse(ISLClientError.notFound.isRetryable)
    }
    
    // MARK: - Cache Control Header Tests
    
    func testCacheControlHeaderParsing() {
        let header = CacheControlHeader(from: "max-age=300, public")
        
        XCTAssertEqual(header.maxAge, 300)
        XCTAssertTrue(header.isPublic)
        XCTAssertFalse(header.noCache)
        XCTAssertTrue(header.isCacheable)
    }
    
    func testCacheControlNoStore() {
        let header = CacheControlHeader(from: "no-store, no-cache")
        
        XCTAssertTrue(header.noStore)
        XCTAssertTrue(header.noCache)
        XCTAssertFalse(header.isCacheable)
    }
    
    // MARK: - Integration Style Tests
    
    @MainActor
    func testMockClientCreateUser() async throws {
        let mockClient = MockUserServiceClient()
        
        let expectedUser = User(
            id: UUID(),
            email: try Email("test@example.com"),
            username: "testuser",
            displayName: nil,
            status: .pending,
            permissionLevel: .read,
            subscriptionTier: .free,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        mockClient.createUserHandler = { input in
            XCTAssertEqual(input.username, "testuser")
            return expectedUser
        }
        
        let email = try Email("test@example.com")
        let input = CreateUserInput(email: email, username: "testuser")
        let user = try await mockClient.createUser(input)
        
        XCTAssertEqual(user.id, expectedUser.id)
        XCTAssertEqual(user.status, .pending)
    }
    
    @MainActor
    func testMockClientListUsers() async throws {
        let mockClient = MockUserServiceClient()
        
        let users = [
            User(
                id: UUID(),
                email: try Email("user1@example.com"),
                username: "user1",
                displayName: nil,
                status: .active,
                permissionLevel: .read,
                subscriptionTier: .free,
                createdAt: Date(),
                updatedAt: Date()
            ),
            User(
                id: UUID(),
                email: try Email("user2@example.com"),
                username: "user2",
                displayName: nil,
                status: .active,
                permissionLevel: .write,
                subscriptionTier: .pro,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]
        
        mockClient.listUsersHandler = { pagination in
            PaginatedResponse(
                items: users,
                total: 2,
                page: pagination.page,
                pageSize: pagination.pageSize
            )
        }
        
        let response = try await mockClient.listUsers()
        
        XCTAssertEqual(response.items.count, 2)
        XCTAssertFalse(response.hasMore)
    }
}

// MARK: - Async Test Helpers

extension XCTestCase {
    func assertThrowsErrorAsync<T>(
        _ expression: @autoclosure () async throws -> T,
        _ message: @autoclosure () -> String = "",
        file: StaticString = #filePath,
        line: UInt = #line,
        _ errorHandler: (_ error: Error) -> Void = { _ in }
    ) async {
        do {
            _ = try await expression()
            XCTFail(message(), file: file, line: line)
        } catch {
            errorHandler(error)
        }
    }
}
