# ISL Kotlin SDK ProGuard Rules
# Keep these rules when using R8/ProGuard with the SDK

# =============================================================================
# ISL SDK Models
# =============================================================================

# Keep all model classes and their members
-keep class com.isl.client.models.** { *; }
-keepclassmembers class com.isl.client.models.** { *; }

# Keep value classes
-keep class com.isl.client.models.Email { *; }
-keep class com.isl.client.models.Username { *; }
-keep class com.isl.client.models.UserId { *; }
-keep class com.isl.client.models.PageToken { *; }
-keep class com.isl.client.models.PageSize { *; }

# Keep sealed class hierarchies
-keep class com.isl.client.models.CreateUserResult { *; }
-keep class com.isl.client.models.CreateUserResult$* { *; }
-keep class com.isl.client.models.GetUserResult { *; }
-keep class com.isl.client.models.GetUserResult$* { *; }
-keep class com.isl.client.models.UpdateUserResult { *; }
-keep class com.isl.client.models.UpdateUserResult$* { *; }
-keep class com.isl.client.models.DeleteUserResult { *; }
-keep class com.isl.client.models.DeleteUserResult$* { *; }
-keep class com.isl.client.models.ListUsersResult { *; }
-keep class com.isl.client.models.ListUsersResult$* { *; }
-keep class com.isl.client.models.SearchUsersResult { *; }
-keep class com.isl.client.models.SearchUsersResult$* { *; }

# =============================================================================
# ISL SDK Client
# =============================================================================

-keep class com.isl.client.ISLClient { *; }
-keep class com.isl.client.ISLClientConfig { *; }
-keep class com.isl.client.ISLClientConfigBuilder { *; }

# =============================================================================
# Kotlin Serialization
# =============================================================================

-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep `Companion` object fields of serializable classes.
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}

# Keep `serializer()` on companion objects (both default and named).
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep `INSTANCE.serializer()` of serializable objects.
-if @kotlinx.serialization.Serializable class ** {
    public static ** INSTANCE;
}
-keepclassmembers class <1> {
    public static <1> INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

# @Serializable and @Polymorphic are used at runtime for polymorphic serialization.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

# =============================================================================
# Ktor
# =============================================================================

-keep class io.ktor.** { *; }
-keepclassmembers class io.ktor.** { *; }
-dontwarn io.ktor.**

# Ktor client
-keep class io.ktor.client.** { *; }
-keep class io.ktor.client.engine.** { *; }
-keep class io.ktor.client.plugins.** { *; }

# =============================================================================
# OkHttp
# =============================================================================

-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }

# =============================================================================
# Coroutines
# =============================================================================

-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepnames class kotlinx.coroutines.android.AndroidExceptionPreHandler {}
-keepnames class kotlinx.coroutines.android.AndroidDispatcherFactory {}

-keep class kotlinx.coroutines.android.AndroidDispatcherFactory {*;}
-keep class kotlinx.coroutines.internal.MainDispatcherFactory {*;}

-dontwarn kotlinx.coroutines.flow.**

# =============================================================================
# Kotlin
# =============================================================================

-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**

-keepclassmembers class **$WhenMappings {
    <fields>;
}

-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    static void checkParameterIsNotNull(java.lang.Object, java.lang.String);
}

# =============================================================================
# Compose (if using Compose components)
# =============================================================================

-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# =============================================================================
# General
# =============================================================================

# Keep annotations
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}
