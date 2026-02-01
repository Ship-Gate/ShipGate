package com.isl.client.networking

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/**
 * Collection of pre-built interceptors for common use cases
 */
object Interceptors {
    
    /**
     * Add request ID to all requests for tracing
     */
    fun requestIdInterceptor(): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        request.headers.append("X-Request-ID", UUID.randomUUID().toString())
        request
    }
    
    /**
     * Add timestamp to all requests
     */
    fun timestampInterceptor(): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        request.headers.append("X-Request-Timestamp", System.currentTimeMillis().toString())
        request
    }
    
    /**
     * Add custom header to all requests
     */
    fun customHeaderInterceptor(
        headerName: String,
        headerValue: String
    ): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        request.headers.append(headerName, headerValue)
        request
    }
    
    /**
     * Add multiple custom headers
     */
    fun customHeadersInterceptor(
        headers: Map<String, String>
    ): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        headers.forEach { (name, value) ->
            request.headers.append(name, value)
        }
        request
    }
    
    /**
     * Add user agent header
     */
    fun userAgentInterceptor(
        appName: String,
        appVersion: String
    ): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        request.headers.append("User-Agent", "$appName/$appVersion (ISL-SDK/0.1.0; Kotlin)")
        request
    }
    
    /**
     * Add accept language header
     */
    fun acceptLanguageInterceptor(
        language: String = "en-US"
    ): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        request.headers.append("Accept-Language", language)
        request
    }
    
    /**
     * Add idempotency key for POST requests
     */
    fun idempotencyInterceptor(): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        if (request.method == HttpMethod.Post || request.method == HttpMethod.Put) {
            request.headers.append("Idempotency-Key", UUID.randomUUID().toString())
        }
        request
    }
    
    /**
     * Request logging interceptor
     */
    fun loggingRequestInterceptor(
        logger: (String) -> Unit = ::println
    ): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        logger(">>> ${request.method.value} ${request.url}")
        request.headers.forEach { name, values ->
            if (!name.equals("Authorization", ignoreCase = true)) {
                logger(">>> $name: ${values.joinToString(", ")}")
            }
        }
        request
    }
    
    /**
     * Response logging interceptor
     */
    fun loggingResponseInterceptor(
        logger: (String) -> Unit = ::println
    ): suspend (HttpResponse) -> HttpResponse = { response ->
        logger("<<< ${response.status.value} ${response.status.description}")
        response.headers.forEach { name, values ->
            logger("<<< $name: ${values.joinToString(", ")}")
        }
        response
    }
}

/**
 * Rate limiter for client-side throttling
 */
class RateLimiter(
    private val maxRequestsPerSecond: Int
) {
    private val mutex = Mutex()
    private val requestTimes = mutableListOf<Long>()
    
    /**
     * Acquire permission to make a request
     * Blocks until the request can be made within rate limits
     */
    suspend fun acquire() {
        mutex.withLock {
            val now = System.currentTimeMillis()
            val windowStart = now - 1000
            
            // Remove requests outside the window
            requestTimes.removeAll { it < windowStart }
            
            // Wait if at capacity
            if (requestTimes.size >= maxRequestsPerSecond) {
                val oldestRequest = requestTimes.first()
                val waitTime = oldestRequest + 1000 - now
                if (waitTime > 0) {
                    kotlinx.coroutines.delay(waitTime)
                }
                requestTimes.removeAt(0)
            }
            
            requestTimes.add(System.currentTimeMillis())
        }
    }
    
    /**
     * Create a rate-limited request interceptor
     */
    fun asInterceptor(): suspend (HttpRequestBuilder) -> HttpRequestBuilder = { request ->
        acquire()
        request
    }
}

/**
 * Request counter for metrics
 */
class RequestMetrics {
    private val totalRequests = AtomicLong(0)
    private val successfulRequests = AtomicLong(0)
    private val failedRequests = AtomicLong(0)
    private val mutex = Mutex()
    private val latencies = mutableListOf<Long>()
    
    /**
     * Record a successful request
     */
    suspend fun recordSuccess(latencyMs: Long) {
        totalRequests.incrementAndGet()
        successfulRequests.incrementAndGet()
        mutex.withLock {
            latencies.add(latencyMs)
            if (latencies.size > 1000) {
                latencies.removeAt(0)
            }
        }
    }
    
    /**
     * Record a failed request
     */
    fun recordFailure() {
        totalRequests.incrementAndGet()
        failedRequests.incrementAndGet()
    }
    
    /**
     * Get current metrics
     */
    suspend fun getMetrics(): Metrics {
        return mutex.withLock {
            Metrics(
                totalRequests = totalRequests.get(),
                successfulRequests = successfulRequests.get(),
                failedRequests = failedRequests.get(),
                averageLatencyMs = if (latencies.isNotEmpty()) latencies.average().toLong() else 0,
                p50LatencyMs = latencies.sorted().getOrNull(latencies.size / 2) ?: 0,
                p95LatencyMs = latencies.sorted().getOrNull((latencies.size * 0.95).toInt()) ?: 0,
                p99LatencyMs = latencies.sorted().getOrNull((latencies.size * 0.99).toInt()) ?: 0
            )
        }
    }
    
    /**
     * Reset all metrics
     */
    suspend fun reset() {
        totalRequests.set(0)
        successfulRequests.set(0)
        failedRequests.set(0)
        mutex.withLock {
            latencies.clear()
        }
    }
    
    data class Metrics(
        val totalRequests: Long,
        val successfulRequests: Long,
        val failedRequests: Long,
        val averageLatencyMs: Long,
        val p50LatencyMs: Long,
        val p95LatencyMs: Long,
        val p99LatencyMs: Long
    ) {
        val successRate: Double
            get() = if (totalRequests > 0) {
                successfulRequests.toDouble() / totalRequests
            } else 0.0
    }
}

/**
 * Circuit breaker for fault tolerance
 */
class CircuitBreaker(
    private val failureThreshold: Int = 5,
    private val resetTimeoutMs: Long = 30_000,
    private val halfOpenMaxRequests: Int = 3
) {
    private var state: State = State.CLOSED
    private var failureCount = 0
    private var lastFailureTime: Long = 0
    private var halfOpenRequests = 0
    private val mutex = Mutex()
    
    enum class State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }
    
    /**
     * Check if request is allowed
     */
    suspend fun allowRequest(): Boolean {
        return mutex.withLock {
            when (state) {
                State.CLOSED -> true
                State.OPEN -> {
                    if (System.currentTimeMillis() - lastFailureTime >= resetTimeoutMs) {
                        state = State.HALF_OPEN
                        halfOpenRequests = 0
                        true
                    } else {
                        false
                    }
                }
                State.HALF_OPEN -> {
                    if (halfOpenRequests < halfOpenMaxRequests) {
                        halfOpenRequests++
                        true
                    } else {
                        false
                    }
                }
            }
        }
    }
    
    /**
     * Record a successful request
     */
    suspend fun recordSuccess() {
        mutex.withLock {
            when (state) {
                State.HALF_OPEN -> {
                    if (halfOpenRequests >= halfOpenMaxRequests) {
                        state = State.CLOSED
                        failureCount = 0
                    }
                }
                else -> {
                    failureCount = 0
                }
            }
        }
    }
    
    /**
     * Record a failed request
     */
    suspend fun recordFailure() {
        mutex.withLock {
            failureCount++
            lastFailureTime = System.currentTimeMillis()
            
            when (state) {
                State.CLOSED -> {
                    if (failureCount >= failureThreshold) {
                        state = State.OPEN
                    }
                }
                State.HALF_OPEN -> {
                    state = State.OPEN
                }
                else -> {}
            }
        }
    }
    
    /**
     * Get current state
     */
    suspend fun getState(): State = mutex.withLock { state }
    
    /**
     * Reset circuit breaker
     */
    suspend fun reset() {
        mutex.withLock {
            state = State.CLOSED
            failureCount = 0
            lastFailureTime = 0
            halfOpenRequests = 0
        }
    }
}

/**
 * Exception thrown when circuit breaker is open
 */
class CircuitBreakerOpenException : Exception("Circuit breaker is open")
