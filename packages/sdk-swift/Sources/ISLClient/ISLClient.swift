import Foundation
import SwiftUI

// MARK: - ISL Client Configuration

/// Configuration for ISL clients
public struct ISLClientConfiguration: Sendable {
    public let baseURL: URL
    public let timeout: TimeInterval
    public let retryPolicy: RetryPolicy
    public let cachePolicy: CachePolicy
    public let cacheConfiguration: CacheConfiguration
    public let verificationConfiguration: VerificationConfiguration
    public let interceptors: [any Interceptor]
    
    public init(
        baseURL: URL,
        timeout: TimeInterval = 30,
        retryPolicy: RetryPolicy = .default,
        cachePolicy: CachePolicy = .networkOnly,
        cacheConfiguration: CacheConfiguration = .default,
        verificationConfiguration: VerificationConfiguration = .default,
        interceptors: [any Interceptor] = []
    ) {
        self.baseURL = baseURL
        self.timeout = timeout
        self.retryPolicy = retryPolicy
        self.cachePolicy = cachePolicy
        self.cacheConfiguration = cacheConfiguration
        self.verificationConfiguration = verificationConfiguration
        self.interceptors = interceptors
    }
}

// MARK: - User Service Client

/// Client for User service APIs
/// Generated from ISL service definition
@MainActor
public final class UserServiceClient: ObservableObject {
    private let apiClient: APIClient
    private let configuration: ISLClientConfiguration
    private let createUserValidator = CreateUserValidator()
    private let createUserVerifier = CreateUserContractVerifier()
    private let updateUserVerifier = UpdateUserContractVerifier()
    private let userCache: EntityCache<User>
    
    @Published public private(set) var isLoading = false
    @Published public private(set) var lastError: Error?
    
    public init(
        baseURL: URL,
        authToken: String? = nil
    ) {
        var interceptors: [any Interceptor] = [
            UserAgentInterceptor(),
            RequestIDInterceptor(),
            LoggingInterceptor(level: .basic),
            RetryInterceptor()
        ]
        
        if let token = authToken {
            interceptors.insert(AuthInterceptor(token: token), at: 0)
        }
        
        self.configuration = ISLClientConfiguration(
            baseURL: baseURL,
            interceptors: interceptors
        )
        
        self.apiClient = APIClient(configuration: APIClientConfiguration(
            baseURL: baseURL,
            interceptors: interceptors
        ))
        
        self.userCache = EntityCache<User>()
    }
    
    public init(configuration: ISLClientConfiguration) {
        self.configuration = configuration
        self.apiClient = APIClient(configuration: APIClientConfiguration(
            baseURL: configuration.baseURL,
            timeout: configuration.timeout,
            interceptors: configuration.interceptors,
            cachePolicy: configuration.cachePolicy
        ))
        self.userCache = EntityCache<User>()
    }
    
    // MARK: - Create User
    
    /// Create a new user
    /// - Preconditions: Email must be valid, username 3-30 chars
    /// - Postconditions: User created with PENDING status
    public func createUser(_ input: CreateUserInput) async throws -> User {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            // Client-side precondition validation
            try createUserValidator.validate(input)
            try await createUserVerifier.verifyPreconditions(input)
            
            let endpoint = UserEndpoints.create(input: input)
            let response: APIResponse<User, CreateUserError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success(let user):
                // Verify postconditions
                try await createUserVerifier.verifyPostconditions(input: input, result: user)
                
                // Cache the new user
                await userCache.set(user)
                
                return user
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Get User
    
    /// Get a user by ID
    public func getUser(id: UUID, cachePolicy: CachePolicy? = nil) async throws -> User {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            // Check cache first if policy allows
            let policy = cachePolicy ?? configuration.cachePolicy
            if policy.shouldCheckCache, let cached = await userCache.get(id) {
                return cached
            }
            
            let endpoint = UserEndpoints.get(id: id)
            let response: APIResponse<User, GetUserError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success(let user):
                await userCache.set(user)
                return user
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Update User
    
    /// Update a user
    public func updateUser(id: UUID, input: UpdateUserInput) async throws -> User {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            // Validate input
            try UpdateUserValidator().validate(input)
            
            // Get original user for postcondition verification
            let original = try await getUser(id: id)
            
            let endpoint = UserEndpoints.update(id: id, input: input)
            let response: APIResponse<User, UpdateUserError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success(let user):
                // Verify postconditions
                try await updateUserVerifier.verifyPostconditions(
                    input: input,
                    original: original,
                    result: user
                )
                
                // Update cache
                await userCache.set(user)
                
                return user
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Delete User
    
    /// Delete a user
    public func deleteUser(id: UUID) async throws {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            let endpoint = UserEndpoints.delete(id: id)
            let response: APIResponse<EmptyResponse, DeleteUserError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success:
                // Remove from cache
                await userCache.remove(id)
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    // MARK: - List Users
    
    /// List users with pagination
    public func listUsers(pagination: PaginationInput = PaginationInput()) async throws -> PaginatedResponse<User> {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            let endpoint = UserEndpoints.list(pagination: pagination)
            let response: APIResponse<PaginatedResponse<User>, ListUsersError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success(let page):
                // Cache all users
                await userCache.setAll(page.items)
                return page
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    // MARK: - Cache Management
    
    /// Clear user cache
    public func clearCache() async {
        await userCache.clear()
    }
}

// MARK: - Organization Service Client

/// Client for Organization service APIs
/// Generated from ISL service definition
@MainActor
public final class OrganizationServiceClient: ObservableObject {
    private let apiClient: APIClient
    private let configuration: ISLClientConfiguration
    private let createOrgValidator = CreateOrganizationValidator()
    private let createOrgVerifier = CreateOrganizationContractVerifier()
    private let orgCache: EntityCache<Organization>
    private let currentUserId: UUID
    
    @Published public private(set) var isLoading = false
    @Published public private(set) var lastError: Error?
    
    public init(
        baseURL: URL,
        currentUserId: UUID,
        authToken: String? = nil
    ) {
        self.currentUserId = currentUserId
        
        var interceptors: [any Interceptor] = [
            UserAgentInterceptor(),
            RequestIDInterceptor(),
            LoggingInterceptor(level: .basic),
            RetryInterceptor()
        ]
        
        if let token = authToken {
            interceptors.insert(AuthInterceptor(token: token), at: 0)
        }
        
        self.configuration = ISLClientConfiguration(
            baseURL: baseURL,
            interceptors: interceptors
        )
        
        self.apiClient = APIClient(configuration: APIClientConfiguration(
            baseURL: baseURL,
            interceptors: interceptors
        ))
        
        self.orgCache = EntityCache<Organization>()
    }
    
    /// Create a new organization
    public func createOrganization(_ input: CreateOrganizationInput) async throws -> Organization {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            // Validate input
            try createOrgValidator.validate(input)
            try await createOrgVerifier.verifyPreconditions(input)
            
            let endpoint = OrganizationEndpoints.create(input: input)
            let response: APIResponse<Organization, CreateOrganizationError> = try await apiClient.request(endpoint)
            
            switch response {
            case .success(let org):
                // Verify postconditions
                try await createOrgVerifier.verifyPostconditions(
                    input: input,
                    ownerId: currentUserId,
                    result: org
                )
                
                await orgCache.set(org)
                return org
                
            case .failure(let error):
                throw error
            }
        } catch {
            lastError = error
            throw error
        }
    }
    
    /// Get organization by ID
    public func getOrganization(id: UUID) async throws -> Organization {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            if let cached = await orgCache.get(id) {
                return cached
            }
            
            let endpoint = OrganizationEndpoints.get(id: id)
            let org: Organization = try await apiClient.request(endpoint)
            await orgCache.set(org)
            return org
        } catch {
            lastError = error
            throw error
        }
    }
    
    /// Get organization by slug
    public func getOrganization(slug: String) async throws -> Organization {
        isLoading = true
        lastError = nil
        defer { isLoading = false }
        
        do {
            let endpoint = OrganizationEndpoints.getBySlug(slug: slug)
            let org: Organization = try await apiClient.request(endpoint)
            await orgCache.set(org)
            return org
        } catch {
            lastError = error
            throw error
        }
    }
}

// MARK: - SwiftUI Views

/// Create user view
public struct CreateUserView: View {
    @ObservedObject private var client: UserServiceClient
    @State private var email = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var showError = false
    
    public init(client: UserServiceClient) {
        self.client = client
    }
    
    public var body: some View {
        Form {
            Section("User Details") {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
                
                TextField("Username", text: $username)
                    .textContentType(.username)
                    .autocapitalization(.none)
                
                TextField("Display Name (optional)", text: $displayName)
            }
            
            Section {
                Button(action: createUser) {
                    if client.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Create User")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(client.isLoading || !isValid)
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(client.lastError?.localizedDescription ?? "An error occurred")
        }
    }
    
    private var isValid: Bool {
        !email.isEmpty && !username.isEmpty && username.count >= 3
    }
    
    private func createUser() {
        Task {
            do {
                let emailValue = try Email(email)
                let input = CreateUserInput(
                    email: emailValue,
                    username: username,
                    displayName: displayName.isEmpty ? nil : displayName
                )
                _ = try await client.createUser(input)
            } catch {
                showError = true
            }
        }
    }
}

/// User list view
public struct UserListView: View {
    @ObservedObject private var client: UserServiceClient
    @State private var users: [User] = []
    @State private var hasMore = false
    @State private var currentPage = 1
    
    public init(client: UserServiceClient) {
        self.client = client
    }
    
    public var body: some View {
        List {
            ForEach(users) { user in
                UserRowView(user: user)
            }
            
            if hasMore {
                Button("Load More") {
                    Task { await loadMore() }
                }
                .disabled(client.isLoading)
            }
        }
        .task {
            await loadUsers()
        }
        .refreshable {
            await loadUsers()
        }
    }
    
    private func loadUsers() async {
        do {
            currentPage = 1
            let response = try await client.listUsers(pagination: PaginationInput(page: currentPage))
            users = response.items
            hasMore = response.hasMore
        } catch {
            // Error handled by client
        }
    }
    
    private func loadMore() async {
        do {
            currentPage += 1
            let response = try await client.listUsers(pagination: PaginationInput(page: currentPage))
            users.append(contentsOf: response.items)
            hasMore = response.hasMore
        } catch {
            currentPage -= 1
        }
    }
}

/// User row view
public struct UserRowView: View {
    let user: User
    
    public init(user: User) {
        self.user = user
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(user.displayName ?? user.username)
                .font(.headline)
            
            Text(user.email.value)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack {
                StatusBadge(status: user.status)
                
                Spacer()
                
                Text("Joined \(user.createdAt, style: .date)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

/// Status badge view
public struct StatusBadge: View {
    let status: UserStatus
    
    public init(status: UserStatus) {
        self.status = status
    }
    
    public var body: some View {
        Text(status.rawValue)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(.white)
            .cornerRadius(4)
    }
    
    private var backgroundColor: Color {
        switch status {
        case .pending:
            return .orange
        case .active:
            return .green
        case .suspended:
            return .red
        }
    }
}

// MARK: - Mock Client for Testing

/// Mock user service client for testing
@MainActor
public final class MockUserServiceClient: ObservableObject {
    @Published public var isLoading = false
    @Published public var lastError: Error?
    
    public var createUserHandler: ((CreateUserInput) async throws -> User)?
    public var getUserHandler: ((UUID) async throws -> User)?
    public var updateUserHandler: ((UUID, UpdateUserInput) async throws -> User)?
    public var deleteUserHandler: ((UUID) async throws -> Void)?
    public var listUsersHandler: ((PaginationInput) async throws -> PaginatedResponse<User>)?
    
    public init() {}
    
    public func createUser(_ input: CreateUserInput) async throws -> User {
        guard let handler = createUserHandler else {
            throw ISLClientError.unknown
        }
        return try await handler(input)
    }
    
    public func getUser(id: UUID, cachePolicy: CachePolicy? = nil) async throws -> User {
        guard let handler = getUserHandler else {
            throw ISLClientError.unknown
        }
        return try await handler(id)
    }
    
    public func updateUser(id: UUID, input: UpdateUserInput) async throws -> User {
        guard let handler = updateUserHandler else {
            throw ISLClientError.unknown
        }
        return try await handler(id, input)
    }
    
    public func deleteUser(id: UUID) async throws {
        guard let handler = deleteUserHandler else {
            throw ISLClientError.unknown
        }
        try await handler(id)
    }
    
    public func listUsers(pagination: PaginationInput = PaginationInput()) async throws -> PaginatedResponse<User> {
        guard let handler = listUsersHandler else {
            throw ISLClientError.unknown
        }
        return try await handler(pagination)
    }
}

// MARK: - Re-exports

// Re-export commonly used types
public typealias ISLEmail = Email
public typealias ISLUser = User
public typealias ISLUserStatus = UserStatus
