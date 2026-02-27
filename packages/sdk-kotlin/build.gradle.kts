import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.22"
    kotlin("plugin.serialization") version "1.9.22"
    id("com.android.library") version "8.2.0" apply false
    id("org.jetbrains.dokka") version "1.9.10"
    id("maven-publish")
    id("signing")
}

group = "com.intentlang"
version = "0.1.0"

repositories {
    mavenCentral()
    google()
}

val ktorVersion = "2.3.7"
val coroutinesVersion = "1.7.3"
val serializationVersion = "1.6.2"

dependencies {
    // Kotlin
    implementation(kotlin("stdlib"))
    implementation(kotlin("reflect"))
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")
    
    // Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:$serializationVersion")
    
    // Ktor Client
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-okhttp:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-client-auth:$ktorVersion")
    implementation("io.ktor:ktor-client-logging:$ktorVersion")
    implementation("io.ktor:ktor-client-websockets:$ktorVersion")
    
    // OkHttp for Android
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    
    // DateTime
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.5.0")
    
    // Jetpack Compose (optional - for Android projects)
    compileOnly("androidx.compose.runtime:runtime:1.5.4")
    compileOnly("androidx.compose.foundation:foundation:1.5.4")
    compileOnly("androidx.compose.material3:material3:1.1.2")
    compileOnly("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    
    // Testing
    testImplementation(kotlin("test"))
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesVersion")
    testImplementation("io.ktor:ktor-client-mock:$ktorVersion")
    testImplementation("io.mockk:mockk:1.13.9")
    testImplementation("app.cash.turbine:turbine:1.0.0")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs = listOf(
            "-Xjsr305=strict",
            "-opt-in=kotlin.RequiresOptIn",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            "-opt-in=kotlinx.serialization.ExperimentalSerializationApi"
        )
    }
}

tasks.test {
    useJUnitPlatform()
}

// Documentation
tasks.dokkaHtml {
    outputDirectory.set(buildDir.resolve("dokka"))
}

// Publishing
java {
    withJavadocJar()
    withSourcesJar()
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            
            pom {
                name.set("ISL Kotlin SDK")
                description.set("Native Kotlin SDK for ISL-verified APIs with Android optimization")
                url.set("https://github.com/intentlang/sdk-kotlin")
                
                licenses {
                    license {
                        name.set("MIT License")
                        url.set("https://opensource.org/licenses/MIT")
                    }
                }
                
                developers {
                    developer {
                        id.set("intentlang")
                        name.set("IntentLang Team")
                        email.set("team@intentlang.dev")
                    }
                }
                
                scm {
                    connection.set("scm:git:git://github.com/intentlang/sdk-kotlin.git")
                    developerConnection.set("scm:git:ssh://github.com/intentlang/sdk-kotlin.git")
                    url.set("https://github.com/intentlang/sdk-kotlin")
                }
            }
        }
    }
    
    repositories {
        maven {
            name = "OSSRH"
            url = uri("https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/")
            credentials {
                username = System.getenv("OSSRH_USERNAME")
                password = System.getenv("OSSRH_PASSWORD")
            }
        }
    }
}

signing {
    sign(publishing.publications["maven"])
}
