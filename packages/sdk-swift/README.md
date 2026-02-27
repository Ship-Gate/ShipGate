# ISLClient - Swift SDK

Native Swift SDK for ISL-verified APIs with SwiftUI integration, async/await support, and runtime verification.

## Features

- **Type-Safe API Clients**: Generated from ISL specifications with full type safety
- **Runtime Verification**: Client-side pre/postcondition validation
- **SwiftUI Integration**: Observable clients and ready-to-use views
- **Async/Await**: Modern Swift concurrency support
- **Interceptors**: Pluggable auth, logging, retry, and caching
- **Offline Support**: Response caching with configurable policies

## Requirements

- iOS 15.0+ / macOS 12.0+ / watchOS 8.0+ / tvOS 15.0+
- Swift 5.9+
- Xcode 15.0+

## Installation

### Swift Package Manager

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/intentos/sdk-swift.git", from: "1.0.0")
]
```

Or in Xcode: File → Add Package Dependencies → Enter repository URL.

## Quick Start

### Basic Usage

```swift
import ISLClient

// Initialize client
let client = UserServiceClient(
    baseURL: URL(string: "https://api.example.com")!,
    authToken: "your-token"
)

// Create a user
do {
    let email = try Email("user@example.com")
    let input = CreateUserInput(email: email, username: "johndoe")
    let user = try await client.createUser(input)
    print("Created user: \(user.id)")
} catch let error as CreateUserError {
    switch error {
    case .duplicateEmail:
        print("Email already exists")
    case .invalidInput(let message):
        print("Invalid input: \(message)")
    case .rateLimited(let retryAfter):
        print("Rate limited, retry after \(retryAfter)s")
    }
}
```

### SwiftUI Integration

```swift
import SwiftUI
import ISLClient

struct ContentView: View {
    @StateObject private var client = UserServiceClient(
        baseURL: URL(string: "https://api.example.com")!
    )
    
    var body: some View {
        NavigationView {
            CreateUserView(client: client)
                .navigationTitle("Create User")
        }
    }
}
```

### Custom Configuration

```swift
let config = ISLClientConfiguration(
    baseURL: URL(string: "https://api.example.com")!,
    timeout: 30,
    retryPolicy: .exponentialBackoff(maxRetries: 3),
    cachePolicy: .cacheFirst(maxAge: 300),
    interceptors: [
        AuthInterceptor(tokenProvider: { await getToken() }),
        LoggingInterceptor(level: .debug),
        MetricsInterceptor()
    ]
)

let client = UserServiceClient(configuration: config)
```

## Architecture

### Type Safety from ISL

Types are generated directly from ISL specifications:

```swift
// ISL type definition generates:
public struct Email: Codable, Equatable, Sendable {
    public let value: String
    
    public init(_ value: String) throws {
        // Validates constraints from ISL spec
        guard value.contains("@") else {
            throw ValidationError.invalidEmail
        }
        self.value = value
    }
}
```

### Runtime Verification

The SDK performs client-side verification of ISL contracts:

```swift
// Preconditions checked before API call
try validateCreateUserPreconditions(input)

// API call
let user = try await apiClient.request(endpoint)

// Postconditions verified after response
try verifyCreateUserPostconditions(input: input, result: user)
```

### Interceptors

Build custom request/response pipelines:

```swift
public protocol Interceptor: Sendable {
    func intercept(
        request: URLRequest,
        next: @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) async throws -> (Data, URLResponse)
}
```

## Error Handling

All errors are strongly typed based on ISL specifications:

```swift
public enum CreateUserError: Error, Codable, Sendable {
    case duplicateEmail
    case invalidInput(message: String)
    case rateLimited(retryAfter: TimeInterval)
}

// Network/validation errors
public enum ISLClientError: Error {
    case networkError(underlying: Error)
    case decodingError(underlying: Error)
    case validationError(ValidationError)
    case verificationError(VerificationError)
}
```

## Caching

Configure response caching per-endpoint:

```swift
let client = UserServiceClient(
    baseURL: url,
    cachePolicy: .cacheFirst(maxAge: 300)
)

// Or per-request
let user = try await client.getUser(id: userId, cachePolicy: .networkOnly)
```

## Testing

Mock clients for unit testing:

```swift
let mockClient = MockUserServiceClient()
mockClient.createUserHandler = { input in
    return User(
        id: UUID(),
        email: input.email,
        username: input.username,
        status: .pending,
        createdAt: Date(),
        updatedAt: Date()
    )
}

// Inject mock in tests
let viewModel = UserViewModel(client: mockClient)
```

## License

MIT License - see LICENSE file for details.
