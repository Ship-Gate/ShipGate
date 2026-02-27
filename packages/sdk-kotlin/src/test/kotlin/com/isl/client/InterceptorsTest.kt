package com.isl.client

import com.isl.client.networking.*
import kotlinx.coroutines.test.runTest
import kotlin.test.*

class InterceptorsTest {
    
    // ========================================================================
    // Rate Limiter Tests
    // ========================================================================
    
    @Test
    fun `rate limiter allows requests under limit`() = runTest {
        val limiter = RateLimiter(maxRequestsPerSecond = 10)
        
        // Should allow 10 requests without delay
        repeat(10) {
            limiter.acquire()
        }
        
        // Test passes if no exception
    }
    
    // ========================================================================
    // Circuit Breaker Tests
    // ========================================================================
    
    @Test
    fun `circuit breaker starts closed`() = runTest {
        val breaker = CircuitBreaker(
            failureThreshold = 3,
            resetTimeoutMs = 1000
        )
        
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState())
    }
    
    @Test
    fun `circuit breaker allows requests when closed`() = runTest {
        val breaker = CircuitBreaker(failureThreshold = 3)
        
        assertTrue(breaker.allowRequest())
    }
    
    @Test
    fun `circuit breaker opens after threshold failures`() = runTest {
        val breaker = CircuitBreaker(
            failureThreshold = 3,
            resetTimeoutMs = 10000
        )
        
        // Record failures up to threshold
        repeat(3) {
            breaker.recordFailure()
        }
        
        assertEquals(CircuitBreaker.State.OPEN, breaker.getState())
        assertFalse(breaker.allowRequest())
    }
    
    @Test
    fun `circuit breaker resets on success`() = runTest {
        val breaker = CircuitBreaker(failureThreshold = 3)
        
        // Record some failures (but not enough to open)
        breaker.recordFailure()
        breaker.recordFailure()
        
        // Record success - should reset failure count
        breaker.recordSuccess()
        
        // Should still be closed and allow requests
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState())
        assertTrue(breaker.allowRequest())
    }
    
    @Test
    fun `circuit breaker reset clears state`() = runTest {
        val breaker = CircuitBreaker(failureThreshold = 3)
        
        // Open the circuit
        repeat(3) { breaker.recordFailure() }
        assertEquals(CircuitBreaker.State.OPEN, breaker.getState())
        
        // Reset
        breaker.reset()
        
        // Should be closed again
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState())
        assertTrue(breaker.allowRequest())
    }
    
    // ========================================================================
    // Request Metrics Tests
    // ========================================================================
    
    @Test
    fun `request metrics tracks successful requests`() = runTest {
        val metrics = RequestMetrics()
        
        metrics.recordSuccess(100)
        metrics.recordSuccess(200)
        metrics.recordSuccess(300)
        
        val stats = metrics.getMetrics()
        assertEquals(3, stats.totalRequests)
        assertEquals(3, stats.successfulRequests)
        assertEquals(0, stats.failedRequests)
        assertEquals(200, stats.averageLatencyMs)
    }
    
    @Test
    fun `request metrics tracks failed requests`() = runTest {
        val metrics = RequestMetrics()
        
        metrics.recordSuccess(100)
        metrics.recordFailure()
        metrics.recordFailure()
        
        val stats = metrics.getMetrics()
        assertEquals(3, stats.totalRequests)
        assertEquals(1, stats.successfulRequests)
        assertEquals(2, stats.failedRequests)
    }
    
    @Test
    fun `request metrics calculates success rate`() = runTest {
        val metrics = RequestMetrics()
        
        metrics.recordSuccess(100)
        metrics.recordSuccess(100)
        metrics.recordSuccess(100)
        metrics.recordFailure()
        
        val stats = metrics.getMetrics()
        assertEquals(0.75, stats.successRate, 0.01)
    }
    
    @Test
    fun `request metrics reset clears all data`() = runTest {
        val metrics = RequestMetrics()
        
        metrics.recordSuccess(100)
        metrics.recordFailure()
        
        metrics.reset()
        
        val stats = metrics.getMetrics()
        assertEquals(0, stats.totalRequests)
        assertEquals(0, stats.successfulRequests)
        assertEquals(0, stats.failedRequests)
    }
    
    // ========================================================================
    // Interceptor Factory Tests
    // ========================================================================
    
    @Test
    fun `custom header interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.customHeaderInterceptor("X-Test", "value")
        
        // Just verify it's callable
        assertNotNull(interceptor)
    }
    
    @Test
    fun `custom headers interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.customHeadersInterceptor(
            mapOf(
                "X-Test-1" to "value1",
                "X-Test-2" to "value2"
            )
        )
        
        assertNotNull(interceptor)
    }
    
    @Test
    fun `user agent interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.userAgentInterceptor("MyApp", "1.0.0")
        
        assertNotNull(interceptor)
    }
    
    @Test
    fun `accept language interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.acceptLanguageInterceptor("en-US")
        
        assertNotNull(interceptor)
    }
    
    @Test
    fun `request id interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.requestIdInterceptor()
        
        assertNotNull(interceptor)
    }
    
    @Test
    fun `timestamp interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.timestampInterceptor()
        
        assertNotNull(interceptor)
    }
    
    @Test
    fun `idempotency interceptor creates valid interceptor`() = runTest {
        val interceptor = Interceptors.idempotencyInterceptor()
        
        assertNotNull(interceptor)
    }
}
