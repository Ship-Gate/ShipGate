package com.isl.client.networking

import com.isl.client.LogLevel
import com.isl.client.RequestInterceptor
import com.isl.client.ResponseInterceptor
import com.isl.client.models.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.okhttp.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.auth.*
import io.ktor.client.plugins.auth.providers.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.plugins.websocket.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.channels.awaitClose
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

/**
 * Configuration for the API client
 */
data class ApiClientConfig(
    val baseUrl: String,
    val authToken: String? = null,
    val enableLogging: Boolean = false,
    val logLevel: LogLevel = LogLevel.INFO,
    val retryPolicy: RetryPolicy = RetryPolicy(),
    val serialization: SerializationConfig = SerializationConfig(),
    val timeoutMs: Long = 30_000,
    val connectTimeoutMs: Long = 10_000,
    val requestInterceptors: List<RequestInterceptor> = emptyList(),
    val responseInterceptors: List<ResponseInterceptor> = emptyList()
)

/**
 * Retry policy configuration
 */
data class RetryPolicy(
    val maxRetries: Int = 3,
    val retryOnServerErrors: Boolean = true,
    val retryOnTimeout: Boolean = true,
    val exponentialBackoff: Boolean = true,
    val baseDelayMs: Long = 1000,
    val maxDelayMs: Long = 30_000
)

/**
 * Serialization configuration
 */
data class SerializationConfig(
    val ignoreUnknownKeys: Boolean = true,
    val prettyPrint: Boolean = false,
    val encodeDefaults: Boolean = true,
    val isLenient: Boolean = false
)

/**
 * Low-level HTTP client wrapper for ISL SDK
 * 
 * Handles:
 * - HTTP requests with Ktor
 * - Authentication
 * - Retry logic
 * - Serialization
 * - Error handling
 * - WebSocket connections
 */
class ApiClient(private val config: ApiClientConfig) {
    
    private val json = Json {
        ignoreUnknownKeys = config.serialization.ignoreUnknownKeys
        prettyPrint = config.serialization.prettyPrint
        encodeDefaults = config.serialization.encodeDefaults
        isLenient = config.serialization.isLenient
    }
    
    /**
     * Underlying Ktor HTTP client
     */
    val httpClient: HttpClient = HttpClient(OkHttp) {
        // OkHttp engine configuration
        engine {
            config {
                connectTimeout(config.connectTimeoutMs, TimeUnit.MILLISECONDS)
                readTimeout(config.timeoutMs, TimeUnit.MILLISECONDS)
                writeTimeout(config.timeoutMs, TimeUnit.MILLISECONDS)
                
                // Connection pool
                connectionPool(okhttp3.ConnectionPool(5, 5, TimeUnit.MINUTES))
            }
            
            // Add OkHttp interceptors if needed
            addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .addHeader("X-Client-SDK", "isl-kotlin/0.1.0")
                    .addHeader("X-Client-Platform", "Android")
                    .build()
                chain.proceed(request)
            }
        }
        
        // JSON serialization
        install(ContentNegotiation) {
            json(json)
        }
        
        // Authentication
        config.authToken?.let { token ->
            install(Auth) {
                bearer {
                    loadTokens {
                        BearerTokens(token, "")
                    }
                }
            }
        }
        
        // Logging
        if (config.enableLogging) {
            install(Logging) {
                logger = Logger.DEFAULT
                level = when (config.logLevel) {
                    LogLevel.NONE -> io.ktor.client.plugins.logging.LogLevel.NONE
                    LogLevel.INFO -> io.ktor.client.plugins.logging.LogLevel.INFO
                    LogLevel.HEADERS -> io.ktor.client.plugins.logging.LogLevel.HEADERS
                    LogLevel.BODY -> io.ktor.client.plugins.logging.LogLevel.BODY
                    LogLevel.ALL -> io.ktor.client.plugins.logging.LogLevel.ALL
                }
            }
        }
        
        // Retry policy
        if (config.retryPolicy.maxRetries > 0) {
            install(HttpRequestRetry) {
                maxRetries = config.retryPolicy.maxRetries
                
                if (config.retryPolicy.retryOnServerErrors) {
                    retryOnServerErrors()
                }
                
                if (config.retryPolicy.retryOnTimeout) {
                    retryOnException(retryOnTimeout = true)
                }
                
                if (config.retryPolicy.exponentialBackoff) {
                    exponentialDelay(
                        base = config.retryPolicy.baseDelayMs.toDouble(),
                        maxDelayMs = config.retryPolicy.maxDelayMs
                    )
                } else {
                    delayMillis { config.retryPolicy.baseDelayMs }
                }
            }
        }
        
        // Timeouts
        install(HttpTimeout) {
            requestTimeoutMillis = config.timeoutMs
            connectTimeoutMillis = config.connectTimeoutMs
            socketTimeoutMillis = config.timeoutMs
        }
        
        // WebSocket
        install(WebSockets) {
            pingInterval = 30_000
        }
        
        // Default request configuration
        defaultRequest {
            url(config.baseUrl)
            contentType(ContentType.Application.Json)
            accept(ContentType.Application.Json)
        }
    }
    
    /**
     * Execute a GET request
     */
    suspend inline fun <reified T> get(
        path: String,
        queryParams: Map<String, String?> = emptyMap()
    ): ApiResponse<T> = execute {
        get(buildUrl(path, queryParams))
    }
    
    /**
     * Execute a POST request
     */
    suspend inline fun <reified T, reified B> post(
        path: String,
        body: B
    ): ApiResponse<T> = execute {
        post(buildUrl(path)) {
            setBody(body)
        }
    }
    
    /**
     * Execute a PUT request
     */
    suspend inline fun <reified T, reified B> put(
        path: String,
        body: B
    ): ApiResponse<T> = execute {
        put(buildUrl(path)) {
            setBody(body)
        }
    }
    
    /**
     * Execute a PATCH request
     */
    suspend inline fun <reified T, reified B> patch(
        path: String,
        body: B
    ): ApiResponse<T> = execute {
        patch(buildUrl(path)) {
            setBody(body)
        }
    }
    
    /**
     * Execute a DELETE request
     */
    suspend inline fun <reified T> delete(
        path: String
    ): ApiResponse<T> = execute {
        delete(buildUrl(path))
    }
    
    /**
     * Execute HTTP request with error handling
     */
    suspend inline fun <reified T> execute(
        crossinline block: suspend HttpClient.() -> HttpResponse
    ): ApiResponse<T> {
        return try {
            val response = httpClient.block()
            handleResponse(response)
        } catch (e: Exception) {
            handleException(e)
        }
    }
    
    /**
     * Handle HTTP response
     */
    suspend inline fun <reified T> handleResponse(response: HttpResponse): ApiResponse<T> {
        return when (response.status) {
            HttpStatusCode.OK,
            HttpStatusCode.Created,
            HttpStatusCode.Accepted -> {
                try {
                    val body = response.body<T>()
                    ApiResponse.Success(body, response.status.value)
                } catch (e: Exception) {
                    ApiResponse.Error(
                        statusCode = response.status.value,
                        errorCode = ErrorCodes.INTERNAL_ERROR,
                        message = "Failed to parse response: ${e.message}"
                    )
                }
            }
            HttpStatusCode.NoContent -> {
                @Suppress("UNCHECKED_CAST")
                ApiResponse.Success(Unit as T, response.status.value)
            }
            HttpStatusCode.BadRequest -> {
                val body = response.bodyAsText()
                ApiResponse.Error(
                    statusCode = 400,
                    errorCode = ErrorCodes.INVALID_INPUT,
                    message = parseErrorMessage(body)
                )
            }
            HttpStatusCode.Unauthorized -> {
                ApiResponse.Error(
                    statusCode = 401,
                    errorCode = ErrorCodes.UNAUTHORIZED,
                    message = "Unauthorized"
                )
            }
            HttpStatusCode.Forbidden -> {
                ApiResponse.Error(
                    statusCode = 403,
                    errorCode = ErrorCodes.FORBIDDEN,
                    message = "Forbidden"
                )
            }
            HttpStatusCode.NotFound -> {
                ApiResponse.Error(
                    statusCode = 404,
                    errorCode = ErrorCodes.NOT_FOUND,
                    message = "Resource not found"
                )
            }
            HttpStatusCode.Conflict -> {
                val body = response.bodyAsText()
                ApiResponse.Error(
                    statusCode = 409,
                    errorCode = ErrorCodes.CONFLICT,
                    message = parseErrorMessage(body)
                )
            }
            HttpStatusCode.TooManyRequests -> {
                val retryAfter = response.headers["Retry-After"]?.toLongOrNull() ?: 60
                ApiResponse.RateLimited(retryAfter)
            }
            else -> {
                if (response.status.value >= 500) {
                    ApiResponse.Error(
                        statusCode = response.status.value,
                        errorCode = ErrorCodes.INTERNAL_ERROR,
                        message = "Server error: ${response.status.description}"
                    )
                } else {
                    ApiResponse.Error(
                        statusCode = response.status.value,
                        errorCode = ErrorCodes.INTERNAL_ERROR,
                        message = "Unexpected error: ${response.status.description}"
                    )
                }
            }
        }
    }
    
    /**
     * Handle exceptions during request
     */
    fun <T> handleException(e: Exception): ApiResponse<T> {
        return when (e) {
            is java.net.SocketTimeoutException,
            is io.ktor.client.plugins.HttpRequestTimeoutException -> {
                ApiResponse.Error(
                    statusCode = 0,
                    errorCode = ErrorCodes.TIMEOUT,
                    message = "Request timed out",
                    cause = e
                )
            }
            is java.net.UnknownHostException,
            is java.net.ConnectException -> {
                ApiResponse.Error(
                    statusCode = 0,
                    errorCode = ErrorCodes.NETWORK_ERROR,
                    message = "Connection failed: ${e.message}",
                    cause = e
                )
            }
            else -> {
                ApiResponse.Error(
                    statusCode = 0,
                    errorCode = ErrorCodes.INTERNAL_ERROR,
                    message = e.message ?: "Unknown error",
                    cause = e
                )
            }
        }
    }
    
    /**
     * Parse error message from response body
     */
    fun parseErrorMessage(body: String): String {
        return try {
            val error = json.decodeFromString<ErrorResponse>(body)
            error.error.message
        } catch (e: Exception) {
            body.ifBlank { "Unknown error" }
        }
    }
    
    /**
     * Build URL with query parameters
     */
    fun buildUrl(path: String, queryParams: Map<String, String?> = emptyMap()): String {
        val cleanPath = path.trimStart('/')
        val queryString = queryParams
            .filterValues { it != null }
            .map { (key, value) -> "$key=${value}" }
            .joinToString("&")
        
        return if (queryString.isNotEmpty()) {
            "$cleanPath?$queryString"
        } else {
            cleanPath
        }
    }
    
    /**
     * Open WebSocket connection
     */
    inline fun <reified T> webSocket(
        path: String,
        crossinline onMessage: (T) -> Unit
    ): Flow<T> = callbackFlow {
        val cleanPath = path.trimStart('/')
        val wsUrl = config.baseUrl
            .replace("http://", "ws://")
            .replace("https://", "wss://")
        
        httpClient.webSocket("$wsUrl/$cleanPath") {
            for (frame in incoming) {
                when (frame) {
                    is io.ktor.websocket.Frame.Text -> {
                        try {
                            val data = json.decodeFromString<T>(frame.readText())
                            send(data)
                            onMessage(data)
                        } catch (e: Exception) {
                            // Log parsing error
                        }
                    }
                    else -> {}
                }
            }
        }
        
        awaitClose { }
    }
    
    /**
     * Close the client
     */
    fun close() {
        httpClient.close()
    }
}

/**
 * API response wrapper
 */
sealed class ApiResponse<out T> {
    /**
     * Successful response with data
     */
    data class Success<T>(
        val data: T,
        val statusCode: Int
    ) : ApiResponse<T>()
    
    /**
     * Error response
     */
    data class Error(
        val statusCode: Int,
        val errorCode: String,
        val message: String,
        val cause: Throwable? = null
    ) : ApiResponse<Nothing>()
    
    /**
     * Rate limited response
     */
    data class RateLimited(
        val retryAfterSeconds: Long
    ) : ApiResponse<Nothing>()
    
    /**
     * Check if response is successful
     */
    val isSuccess: Boolean
        get() = this is Success
    
    /**
     * Check if response is an error
     */
    val isError: Boolean
        get() = this is Error || this is RateLimited
    
    /**
     * Get data or null
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }
    
    /**
     * Get data or throw
     */
    fun getOrThrow(): T = when (this) {
        is Success -> data
        is Error -> throw httpStatusToException(statusCode, message)
        is RateLimited -> throw RateLimitedException(retryAfterSeconds)
    }
}
