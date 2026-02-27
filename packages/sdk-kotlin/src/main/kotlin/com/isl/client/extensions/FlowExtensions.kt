@file:Suppress("unused")

package com.isl.client.extensions

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * Flow extensions for ISL SDK
 * 
 * Provides utility functions for working with Flow in the SDK.
 */

/**
 * Retry a flow with exponential backoff
 * 
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay before first retry
 * @param maxDelay Maximum delay between retries
 * @param factor Multiplier for exponential backoff
 * @param predicate Predicate to determine if retry should occur
 */
fun <T> Flow<T>.retryWithExponentialBackoff(
    maxRetries: Int = 3,
    initialDelay: Duration = 1.seconds,
    maxDelay: Duration = 30.seconds,
    factor: Double = 2.0,
    predicate: (Throwable) -> Boolean = { true }
): Flow<T> = flow {
    var currentDelay = initialDelay
    var attempt = 0
    
    retryWhen { cause, _ ->
        if (attempt < maxRetries && predicate(cause)) {
            delay(currentDelay)
            currentDelay = minOf(currentDelay * factor, maxDelay)
            attempt++
            true
        } else {
            false
        }
    }.collect { emit(it) }
}

/**
 * Throttle a flow to emit at most one value per specified duration
 * 
 * @param duration Minimum time between emissions
 */
fun <T> Flow<T>.throttle(duration: Duration): Flow<T> = flow {
    var lastEmissionTime = 0L
    collect { value ->
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastEmissionTime >= duration.inWholeMilliseconds) {
            lastEmissionTime = currentTime
            emit(value)
        }
    }
}

/**
 * Debounce a flow - emit only if no new values arrive within duration
 * 
 * @param duration Time to wait before emitting
 */
fun <T> Flow<T>.debounceFlow(duration: Duration): Flow<T> = debounce(duration.inWholeMilliseconds)

/**
 * Map values in a flow with error handling
 * 
 * @param transform Transformation function
 * @return Flow with transformed values, errors are caught and logged
 */
inline fun <T, R> Flow<T>.mapCatching(
    crossinline transform: suspend (T) -> R
): Flow<Result<R>> = map { value ->
    runCatching { transform(value) }
}

/**
 * Filter successful results and extract values
 */
fun <T> Flow<Result<T>>.filterSuccess(): Flow<T> = mapNotNull { it.getOrNull() }

/**
 * Collect flow values into a list with a maximum size
 * 
 * @param maxSize Maximum number of elements to collect
 */
suspend fun <T> Flow<T>.toList(maxSize: Int): List<T> {
    val result = mutableListOf<T>()
    take(maxSize).collect { result.add(it) }
    return result
}

/**
 * Execute a side effect on each emission without affecting the flow
 * 
 * @param action Side effect action
 */
fun <T> Flow<T>.onEachSuspend(action: suspend (T) -> Unit): Flow<T> = onEach { action(it) }

/**
 * Combine multiple flows and emit when any of them emits
 * 
 * @param other Other flow to combine with
 * @param transform Transformation function for combined values
 */
fun <T1, T2, R> Flow<T1>.combineLatest(
    other: Flow<T2>,
    transform: suspend (T1, T2) -> R
): Flow<R> = combine(other, transform)

/**
 * Buffer flow with a specified capacity
 * 
 * @param capacity Buffer capacity
 */
fun <T> Flow<T>.bufferWithCapacity(capacity: Int): Flow<T> = buffer(capacity)

/**
 * Emit a default value if the flow is empty
 * 
 * @param default Default value to emit
 */
fun <T> Flow<T>.defaultIfEmpty(default: T): Flow<T> = flow {
    var emitted = false
    collect { value ->
        emitted = true
        emit(value)
    }
    if (!emitted) {
        emit(default)
    }
}

/**
 * Emit a value at the start of the flow
 * 
 * @param value Value to emit first
 */
fun <T> Flow<T>.startWith(value: T): Flow<T> = flow {
    emit(value)
    collect { emit(it) }
}

/**
 * Emit values at the end of the flow
 * 
 * @param values Values to emit after the flow completes
 */
fun <T> Flow<T>.endWith(vararg values: T): Flow<T> = flow {
    collect { emit(it) }
    values.forEach { emit(it) }
}

/**
 * Skip the first n elements
 * 
 * @param count Number of elements to skip
 */
fun <T> Flow<T>.skipFirst(count: Int): Flow<T> = drop(count)

/**
 * Timeout for flow collection
 * 
 * @param duration Maximum duration for collection
 * @param onTimeout Action to perform on timeout
 */
fun <T> Flow<T>.timeout(
    duration: Duration,
    onTimeout: () -> T? = { null }
): Flow<T> = flow {
    kotlinx.coroutines.withTimeoutOrNull(duration.inWholeMilliseconds) {
        collect { emit(it) }
    } ?: onTimeout()?.let { emit(it) }
}

/**
 * Distinct consecutive values - emit only if different from previous
 */
fun <T> Flow<T>.distinctUntilChangedBy(): Flow<T> = distinctUntilChanged()

/**
 * Scan/accumulate values in a flow
 * 
 * @param initial Initial value
 * @param operation Accumulation operation
 */
fun <T, R> Flow<T>.scanFlow(
    initial: R,
    operation: suspend (R, T) -> R
): Flow<R> = scan(initial, operation)

/**
 * Catch errors and emit a fallback value
 * 
 * @param fallback Fallback value on error
 */
fun <T> Flow<T>.catchAndEmit(fallback: T): Flow<T> = catch { emit(fallback) }

/**
 * Log flow events for debugging
 * 
 * @param tag Log tag
 * @param logger Logger function
 */
fun <T> Flow<T>.log(
    tag: String = "Flow",
    logger: (String) -> Unit = ::println
): Flow<T> = onStart {
    logger("[$tag] Started")
}.onEach { value ->
    logger("[$tag] Emitted: $value")
}.onCompletion { cause ->
    if (cause != null) {
        logger("[$tag] Completed with error: ${cause.message}")
    } else {
        logger("[$tag] Completed successfully")
    }
}.catch { cause ->
    logger("[$tag] Error: ${cause.message}")
    throw cause
}
