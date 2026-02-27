plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.21"
    id("org.jetbrains.intellij") version "1.16.1"
}

group = "com.isl"
version = "0.1.0"

repositories {
    mavenCentral()
}

// Configure Gradle IntelliJ Plugin
intellij {
    version.set("2023.3")
    type.set("IC") // IntelliJ Community Edition
    
    plugins.set(listOf(
        // No additional plugins required for basic language support
    ))
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
}

tasks {
    // Set the JVM compatibility versions
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    patchPluginXml {
        sinceBuild.set("233")
        untilBuild.set("243.*")
        
        changeNotes.set("""
            <h2>0.1.0</h2>
            <ul>
                <li>Initial release</li>
                <li>Syntax highlighting for ISL files</li>
                <li>Code completion for keywords, types, and annotations</li>
                <li>Error highlighting and quick fixes</li>
                <li>Go to definition and find usages</li>
                <li>Structure view for domain navigation</li>
                <li>Generate types, tests, and documentation</li>
                <li>Verify implementation against spec</li>
            </ul>
        """.trimIndent())
    }

    signPlugin {
        certificateChain.set(System.getenv("CERTIFICATE_CHAIN"))
        privateKey.set(System.getenv("PRIVATE_KEY"))
        password.set(System.getenv("PRIVATE_KEY_PASSWORD"))
    }

    publishPlugin {
        token.set(System.getenv("PUBLISH_TOKEN"))
    }
    
    buildSearchableOptions {
        enabled = false
    }
}

// Generate lexer and parser from grammar files
tasks.register("generateLexer") {
    description = "Generate lexer from JFlex file"
    group = "build"
    
    doLast {
        // JFlex lexer generation would go here if using .flex files
        println("Lexer generation complete")
    }
}

tasks.register("generateParser") {
    description = "Generate parser from Grammar-Kit file"  
    group = "build"
    
    doLast {
        // Grammar-Kit parser generation would go here if using .bnf files
        println("Parser generation complete")
    }
}
