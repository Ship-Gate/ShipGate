package com.isl.client

import com.isl.client.networking.ApiClient
import com.isl.client.networking.ApiClientConfig
import com.isl.client.networking.RetryPolicy
import com.isl.client.networking.SerializationConfig
import com.isl.client.services.UserService
import com.isl.client.verification.VerificationConfig
import io.ktor.client.*
import kotlinx.serialization.json.Json

/**
 * Main entry point for the ISL Kotlin SDK.
 * 
 * Provides type-safe access to ISL-verified APIs with automatic
 * precondition/postcondition verification.
 * 
 * @example
 * ```kotlin
 * val client = ISLClient.create {
 *     baseUrl = "https://api.example.com"
 *     authToken = "your-token"
 * }
 * 
 * val result = client.users.createUser(input)
 * ```
 */
class ISLClient private constructor(
    private val config: ISLClientConfig,
    private val apiClient: ApiClient
) {
    /**
     * User service for user-related operations
     */
    val users: UserService by lazy {
        UserService(apiClient, config.verification)
    }
    
    /**
     * Access to the underlying HTTP client for advanced use cases
     */
    val httpClient: HttpClient
        get() = apiClient.httpClient
    
    /**
     * Close the client and release resources
     */
    fun close() {
        apiClient.close()
    }
    
    companion object {
        /**
         * Create a new ISL client with the provided configuration
         * 
         * @param block Configuration block
         * @return Configured ISLClient instance
         */
        fun create(block: ISLClientConfigBuilder.() -> Unit): ISLClient {
            val builder = ISLClientConfigBuilder()
            builder.block()
            val config = builder.build()
            val apiClient = ApiClient(config.toApiClientConfig())
            return ISLClient(config, apiClient)
        }
        
        /**
         * Create a client with minimal configuration
         * 
         * @param baseUrl The base URL of the API
         * @param authToken Optional authentication token
         * @return Configured ISLClient instance
         */
        fun simple(baseUrl: String, authToken: String? = null): ISLClient {
            return create {
                this.baseUrl = baseUrl
                this.authToken = authToken
            }
        }
    }
}

/**
 * Configuration for the ISL client
 */
data class ISLClientConfig(
    val baseUrl: String,
    val authToken: String? = null,
    val enableLogging: Boolean = false,
    val logLevel: LogLevel = LogLevel.INFO,
    val retryPolicy: RetryPolicy = RetryPolicy(),
    val verification: VerificationConfig = VerificationConfig(),
    val serialization: SerializationConfig = SerializationConfig(),
    val timeoutMs: Long = 30_000,
    val connectTimeoutMs: Long = 10_000,
    val requestInterceptors: List<RequestInterceptor> = emptyList(),
    val responseInterceptors: List<ResponseInterceptor> = emptyList()
) {
    internal fun toApiClientConfig(): ApiClientConfig {
        return ApiClientConfig(
            baseUrl = baseUrl,
            authToken = authToken,
            enableLogging = enableLogging,
            logLevel = logLevel,
            retryPolicy = retryPolicy,
            serialization = serialization,
            timeoutMs = timeoutMs,
            connectTimeoutMs = connectTimeoutMs,
            requestInterceptors = requestInterceptors,
            responseInterceptors = responseInterceptors
        )
    }
}

/**
 * Builder for ISL client configuration
 */
class ISLClientConfigBuilder {
    var baseUrl: String = ""
    var authToken: String? = null
    var enableLogging: Boolean = false
    var logLevel: LogLevel = LogLevel.INFO
    var timeoutMs: Long = 30_000
    var connectTimeoutMs: Long = 10_000
    
    private var retryPolicy: RetryPolicy = RetryPolicy()
    private var verification: VerificationConfig = VerificationConfig()
    private var serialization: SerializationConfig = SerializationConfig()
    private val requestInterceptors = mutableListOf<RequestInterceptor>()
    private val responseInterceptors = mutableListOf<ResponseInterceptor>()
    
    /**
     * Configure retry policy
     */
    fun retryPolicy(block: RetryPolicyBuilder.() -> Unit) {
        val builder = RetryPolicyBuilder()
        builder.block()
        retryPolicy = builder.build()
    }
    
    /**
     * Configure verification settings
     */
    fun verification(block: VerificationConfigBuilder.() -> Unit) {
        val builder = VerificationConfigBuilder()
        builder.block()
        verification = builder.build()
    }
    
    /**
     * Configure JSON serialization
     */
    fun json(block: SerializationConfigBuilder.() -> Unit) {
        val builder = SerializationConfigBuilder()
        builder.block()
        serialization = builder.build()
    }
    
    /**
     * Add request/response interceptors
     */
    fun interceptors(block: InterceptorsBuilder.() -> Unit) {
        val builder = InterceptorsBuilder()
        builder.block()
        requestInterceptors.addAll(builder.requestInterceptors)
        responseInterceptors.addAll(builder.responseInterceptors)
    }
    
    internal fun build(): ISLClientConfig {
        require(baseUrl.isNotBlank()) { "baseUrl is required" }
        
        return ISLClientConfig(
            baseUrl = baseUrl.trimEnd('/'),
            authToken = authToken,
            enableLogging = enableLogging,
            logLevel = logLevel,
            retryPolicy = retryPolicy,
            verification = verification,
            serialization = serialization,
            timeoutMs = timeoutMs,
            connectTimeoutMs = connectTimeoutMs,
            requestInterceptors = requestInterceptors.toList(),
            responseInterceptors = responseInterceptors.toList()
        )
    }
}

/**
 * Builder for retry policy
 */
class RetryPolicyBuilder {
    var maxRetries: Int = 3
    var retryOnServerErrors: Boolean = true
    var retryOnTimeout: Boolean = true
    var exponentialBackoff: Boolean = true
    var baseDelayMs: Long = 1000
    var maxDelayMs: Long = 30_000
    
    internal fun build(): RetryPolicy = RetryPolicy(
        maxRetries = maxRetries,
        retryOnServerErrors = retryOnServerErrors,
        retryOnTimeout = retryOnTimeout,
        exponentialBackoff = exponentialBackoff,
        baseDelayMs = baseDelayMs,
        maxDelayMs = maxDelayMs
    )
}

/**
 * Builder for verification config
 */
class VerificationConfigBuilder {
    var enablePreconditions: Boolean = true
    var enablePostconditions: Boolean = true
    var throwOnViolation: Boolean = true
    var logViolations: Boolean = true
    
    internal fun build(): VerificationConfig = VerificationConfig(
        enablePreconditions = enablePreconditions,
        enablePostconditions = enablePostconditions,
        throwOnViolation = throwOnViolation,
        logViolations = logViolations
    )
}

/**
 * Builder for serialization config
 */
class SerializationConfigBuilder {
    var ignoreUnknownKeys: Boolean = true
    var prettyPrint: Boolean = false
    var encodeDefaults: Boolean = true
    var isLenient: Boolean = false
    
    internal fun build(): SerializationConfig = SerializationConfig(
        ignoreUnknownKeys = ignoreUnknownKeys,
        prettyPrint = prettyPrint,
        encodeDefaults = encodeDefaults,
        isLenient = isLenient
    )
}

/**
 * Builder for interceptors
 */
class InterceptorsBuilder {
    internal val requestInterceptors = mutableListOf<RequestInterceptor>()
    internal val responseInterceptors = mutableListOf<ResponseInterceptor>()
    
    fun request(interceptor: RequestInterceptor) {
        requestInterceptors.add(interceptor)
    }
    
    fun response(interceptor: ResponseInterceptor) {
        responseInterceptors.add(interceptor)
    }
}

/**
 * Log level for HTTP logging
 */
enum class LogLevel {
    NONE,
    INFO,
    HEADERS,
    BODY,
    ALL
}

/**
 * Type alias for request interceptor
 */
typealias RequestInterceptor = suspend (io.ktor.client.request.HttpRequestBuilder) -> io.ktor.client.request.HttpRequestBuilder

/**
 * Type alias for response interceptor
 */
typealias ResponseInterceptor = suspend (io.ktor.client.statement.HttpResponse) -> io.ktor.client.statement.HttpResponse
