# ISL Kotlin SDK

Native Kotlin SDK for ISL-verified APIs with Android optimization. Features Coroutines, Ktor, and Jetpack Compose integration.

## Features

- **Type-Safe API Clients**: Generated from ISL specifications with compile-time safety
- **Runtime Verification**: Automatic pre/postcondition checking
- **Coroutines Support**: Full async/await with Flow for reactive streams
- **Android Optimized**: OkHttp engine with proper lifecycle handling
- **Jetpack Compose**: Ready-to-use UI components and state management
- **WebSocket Support**: Real-time updates via Flow
- **Retry Logic**: Exponential backoff with configurable policies

## Installation

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("com.intentlang:sdk-kotlin:0.1.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    implementation 'com.intentlang:sdk-kotlin:0.1.0'
}
```

## Quick Start

### Initialize the Client

```kotlin
import com.isl.client.ISLClient
import com.isl.client.ISLClientConfig

val client = ISLClient.create {
    baseUrl = "https://api.example.com"
    authToken = "your-auth-token"
    
    // Optional configuration
    enableLogging = true
    retryPolicy {
        maxRetries = 3
        exponentialBackoff = true
    }
    verification {
        enablePreconditions = true
        enablePostconditions = true
    }
}
```

### Make API Calls

```kotlin
import com.isl.client.models.*
import kotlinx.coroutines.flow.collect

// Create a user
val result = client.users.createUser(
    CreateUserInput(
        email = "user@example.com",
        username = "newuser"
    )
)

when (result) {
    is CreateUserResult.Success -> {
        println("User created: ${result.user.id}")
    }
    is CreateUserResult.Error.DuplicateEmail -> {
        println("Email already exists")
    }
    is CreateUserResult.Error.InvalidInput -> {
        println("Invalid input: ${result.message}")
    }
    is CreateUserResult.Error.RateLimited -> {
        println("Rate limited, retry after ${result.retryAfter}s")
    }
}
```

### Real-time Updates with Flow

```kotlin
// Observe user updates
client.users.observeUser(userId)
    .collect { user ->
        println("User updated: ${user.status}")
    }
```

## Jetpack Compose Integration

### ViewModel Integration

```kotlin
import com.isl.client.compose.rememberISLClient
import com.isl.client.compose.UserViewModel

@Composable
fun UserScreen() {
    val client = rememberISLClient()
    val viewModel: UserViewModel = viewModel { UserViewModel(client) }
    
    val state by viewModel.state.collectAsStateWithLifecycle()
    
    when (val current = state) {
        is UserState.Loading -> CircularProgressIndicator()
        is UserState.Success -> UserContent(current.user)
        is UserState.Error -> ErrorMessage(current.message)
    }
}
```

### Ready-to-Use Components

```kotlin
import com.isl.client.compose.CreateUserScreen

@Composable
fun App() {
    CreateUserScreen(
        client = client,
        onUserCreated = { user ->
            // Handle success
        }
    )
}
```

## Advanced Configuration

### Custom Interceptors

```kotlin
val client = ISLClient.create {
    baseUrl = "https://api.example.com"
    
    interceptors {
        request { request ->
            request.headers.append("X-Custom-Header", "value")
            request
        }
        response { response ->
            // Log or modify response
            response
        }
    }
}
```

### Custom Serialization

```kotlin
val client = ISLClient.create {
    baseUrl = "https://api.example.com"
    
    json {
        ignoreUnknownKeys = true
        prettyPrint = false
        encodeDefaults = true
    }
}
```

### Retry Policy

```kotlin
val client = ISLClient.create {
    baseUrl = "https://api.example.com"
    
    retryPolicy {
        maxRetries = 5
        retryOnServerErrors = true
        retryOnTimeout = true
        exponentialBackoff = true
        baseDelayMs = 1000
        maxDelayMs = 30000
    }
}
```

## Verification

The SDK automatically verifies preconditions and postconditions defined in ISL specifications.

### Precondition Checking

```kotlin
// This will throw IllegalArgumentException if email is invalid
val result = client.users.createUser(
    CreateUserInput(
        email = "invalid-email", // Missing @
        username = "user"
    )
)
// Throws: IllegalArgumentException: Invalid email format
```

### Postcondition Checking

```kotlin
// The SDK verifies server responses match ISL contracts
val result = client.users.createUser(input)

when (result) {
    is CreateUserResult.Success -> {
        // Guaranteed: result.user.email == input.email
        // Guaranteed: result.user.status == PENDING
    }
}
```

### Disabling Verification

```kotlin
val client = ISLClient.create {
    baseUrl = "https://api.example.com"
    
    verification {
        enablePreconditions = false  // Skip client-side validation
        enablePostconditions = false // Skip response verification
    }
}
```

## Error Handling

### Sealed Classes for Type-Safe Errors

```kotlin
sealed class CreateUserResult {
    data class Success(val user: User) : CreateUserResult()
    sealed class Error : CreateUserResult() {
        data object DuplicateEmail : Error()
        data class InvalidInput(val message: String) : Error()
        data class RateLimited(val retryAfter: Long) : Error()
    }
}
```

### Extension Functions

```kotlin
// Convenient extension functions
val user = result.getOrNull()
val user = result.getOrThrow()
val user = result.getOrElse { defaultUser }

result.onSuccess { user -> /* handle */ }
result.onError { error -> /* handle */ }
```

## Testing

### Mock Client

```kotlin
import com.isl.client.testing.MockISLClient

val mockClient = MockISLClient {
    users.createUser returns CreateUserResult.Success(mockUser)
    users.getUser("123") returns GetUserResult.Success(mockUser)
    users.getUser("404") returns GetUserResult.Error.NotFound
}

// Use in tests
val result = mockClient.users.createUser(input)
```

### Turbine for Flow Testing

```kotlin
@Test
fun `observeUser emits updates`() = runTest {
    mockClient.users.observeUser("123").test {
        assertEquals(UserStatus.PENDING, awaitItem().status)
        assertEquals(UserStatus.ACTIVE, awaitItem().status)
        cancelAndIgnoreRemainingEvents()
    }
}
```

## Android Integration

### Lifecycle-Aware Client

```kotlin
class MyApplication : Application() {
    val islClient by lazy {
        ISLClient.create {
            baseUrl = BuildConfig.API_URL
            authToken = getAuthToken()
        }
    }
}
```

### ProGuard Rules

```proguard
# ISL Kotlin SDK
-keep class com.isl.client.models.** { *; }
-keepclassmembers class com.isl.client.models.** { *; }

# Ktor
-keep class io.ktor.** { *; }
-keepclassmembers class io.ktor.** { *; }

# Kotlinx Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
```

## API Reference

Full API documentation is available at [docs.intentlang.dev/kotlin](https://docs.intentlang.dev/kotlin)

## License

MIT License - see [LICENSE](LICENSE) for details.
