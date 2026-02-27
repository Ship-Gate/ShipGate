package com.isl.client.networking

import com.isl.client.models.*
import kotlinx.serialization.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*
import kotlinx.serialization.json.*
import kotlinx.serialization.modules.*

/**
 * Custom serialization configuration for ISL SDK
 */
object ISLSerialization {
    
    /**
     * Create a configured Json instance for ISL types
     */
    fun createJson(config: SerializationConfig = SerializationConfig()): Json {
        return Json {
            ignoreUnknownKeys = config.ignoreUnknownKeys
            prettyPrint = config.prettyPrint
            encodeDefaults = config.encodeDefaults
            isLenient = config.isLenient
            serializersModule = islSerializersModule
        }
    }
    
    /**
     * Default Json instance
     */
    val json: Json = createJson()
    
    /**
     * Serializers module for ISL types
     */
    val islSerializersModule = SerializersModule {
        // Register custom serializers for value types
        contextual(Email::class, EmailSerializer)
        contextual(Username::class, UsernameSerializer)
        contextual(UserId::class, UserIdSerializer)
        contextual(PageToken::class, PageTokenSerializer)
        contextual(PageSize::class, PageSizeSerializer)
    }
}

/**
 * Serializer for Email value type
 */
object EmailSerializer : KSerializer<Email> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("Email", PrimitiveKind.STRING)
    
    override fun serialize(encoder: Encoder, value: Email) {
        encoder.encodeString(value.value)
    }
    
    override fun deserialize(decoder: Decoder): Email {
        return Email(decoder.decodeString())
    }
}

/**
 * Serializer for Username value type
 */
object UsernameSerializer : KSerializer<Username> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("Username", PrimitiveKind.STRING)
    
    override fun serialize(encoder: Encoder, value: Username) {
        encoder.encodeString(value.value)
    }
    
    override fun deserialize(decoder: Decoder): Username {
        return Username(decoder.decodeString())
    }
}

/**
 * Serializer for UserId value type
 */
object UserIdSerializer : KSerializer<UserId> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("UserId", PrimitiveKind.STRING)
    
    override fun serialize(encoder: Encoder, value: UserId) {
        encoder.encodeString(value.value)
    }
    
    override fun deserialize(decoder: Decoder): UserId {
        return UserId(decoder.decodeString())
    }
}

/**
 * Serializer for PageToken value type
 */
object PageTokenSerializer : KSerializer<PageToken> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("PageToken", PrimitiveKind.STRING)
    
    override fun serialize(encoder: Encoder, value: PageToken) {
        encoder.encodeString(value.value)
    }
    
    override fun deserialize(decoder: Decoder): PageToken {
        return PageToken(decoder.decodeString())
    }
}

/**
 * Serializer for PageSize value type
 */
object PageSizeSerializer : KSerializer<PageSize> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("PageSize", PrimitiveKind.INT)
    
    override fun serialize(encoder: Encoder, value: PageSize) {
        encoder.encodeInt(value.value)
    }
    
    override fun deserialize(decoder: Decoder): PageSize {
        return PageSize(decoder.decodeInt())
    }
}

/**
 * Serializer for Unix timestamps as Instant (optional - for kotlinx-datetime integration)
 */
object UnixTimestampSerializer : KSerializer<Long> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("UnixTimestamp", PrimitiveKind.LONG)
    
    override fun serialize(encoder: Encoder, value: Long) {
        encoder.encodeLong(value)
    }
    
    override fun deserialize(decoder: Decoder): Long {
        return decoder.decodeLong()
    }
}

/**
 * Nullable field transformer - handles API responses that may return null for optional fields
 */
object NullableStringTransformer : JsonTransformingSerializer<String>(String.serializer()) {
    override fun transformDeserialize(element: JsonElement): JsonElement {
        return if (element is JsonNull) {
            JsonPrimitive("")
        } else {
            element
        }
    }
}

/**
 * Extension function to safely parse JSON with error handling
 */
inline fun <reified T> Json.decodeFromStringSafe(string: String): Result<T> {
    return try {
        Result.success(decodeFromString<T>(string))
    } catch (e: SerializationException) {
        Result.failure(SerializationException("Failed to parse JSON: ${e.message}", e))
    }
}

/**
 * Extension function to encode to JSON with error handling
 */
inline fun <reified T> Json.encodeToStringSafe(value: T): Result<String> {
    return try {
        Result.success(encodeToString(value))
    } catch (e: SerializationException) {
        Result.failure(SerializationException("Failed to encode JSON: ${e.message}", e))
    }
}

/**
 * API response wrapper for typed deserialization
 */
@Serializable
data class ApiResponseWrapper<T>(
    val data: T? = null,
    val error: ErrorDetail? = null,
    val meta: ResponseMeta? = null
)

/**
 * Response metadata
 */
@Serializable
data class ResponseMeta(
    val requestId: String? = null,
    val timestamp: Long? = null,
    val version: String? = null
)

/**
 * Paginated response wrapper
 */
@Serializable
data class PaginatedResponseWrapper<T>(
    val data: List<T>,
    val pagination: PaginationInfo
)

/**
 * Pagination information
 */
@Serializable
data class PaginationInfo(
    val nextToken: String? = null,
    val previousToken: String? = null,
    val totalCount: Int? = null,
    val pageSize: Int,
    val hasMore: Boolean = nextToken != null
)
