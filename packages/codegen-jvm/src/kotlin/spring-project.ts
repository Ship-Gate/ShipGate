// ============================================================================
// ISL JVM Code Generator - Kotlin Spring Boot Project Scaffold
// Generates a complete compilable Gradle project from ISL domain
// ============================================================================

import type {
  Domain,
  Entity,
  Behavior,
  Field,
} from '../../../../master_contracts/ast';
import type { GeneratorOptions, GeneratedFile } from '../generator';
import { kotlinTypeFromDef } from './types';

// ============================================================================
// PROJECT OPTIONS
// ============================================================================

export interface SpringProjectOptions extends GeneratorOptions {
  springBootVersion?: string;
  kotlinVersion?: string;
  groupId?: string;
  artifactId?: string;
  javaVersion?: 17 | 21;
}

// ============================================================================
// MAIN PROJECT GENERATOR
// ============================================================================

export function generateSpringProject(
  domain: Domain,
  options: SpringProjectOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const pkg = options.package;
  const pkgPath = pkg.replace(/\./g, '/');
  const springBootVersion = options.springBootVersion ?? '3.2.2';
  const kotlinVersion = options.kotlinVersion ?? '1.9.22';
  const groupId = options.groupId ?? pkg.split('.').slice(0, 2).join('.');
  const artifactId = options.artifactId ?? toKebabCase(domain.name.name);
  const javaVersion = options.javaVersion ?? 17;

  // Build files
  files.push({
    path: 'build.gradle.kts',
    content: generateBuildGradle(springBootVersion, kotlinVersion, groupId, artifactId, javaVersion),
    type: 'config',
  });

  files.push({
    path: 'settings.gradle.kts',
    content: generateSettingsGradle(artifactId),
    type: 'config',
  });

  files.push({
    path: 'gradle.properties',
    content: generateGradleProperties(kotlinVersion),
    type: 'config',
  });

  // Gradle wrapper properties
  files.push({
    path: 'gradle/wrapper/gradle-wrapper.properties',
    content: generateGradleWrapperProperties(),
    type: 'config',
  });

  // Application entry point
  files.push({
    path: `src/main/kotlin/${pkgPath}/Application.kt`,
    content: generateApplicationKt(pkg, domain.name.name),
    type: 'config',
  });

  // application.properties
  files.push({
    path: 'src/main/resources/application.properties',
    content: generateApplicationProperties(artifactId),
    type: 'config',
  });

  // Entity classes with JPA annotations
  for (const entity of domain.entities) {
    files.push({
      path: `src/main/kotlin/${pkgPath}/entities/${entity.name.name}.kt`,
      content: generateJpaEntity(entity, pkg),
      type: 'entity',
    });
  }

  // Enum types
  for (const type of domain.types) {
    if (type.definition.kind === 'EnumType') {
      files.push({
        path: `src/main/kotlin/${pkgPath}/model/${type.name.name}.kt`,
        content: generateEnumFile(type, pkg),
        type: 'type',
      });
    } else {
      files.push({
        path: `src/main/kotlin/${pkgPath}/model/${type.name.name}.kt`,
        content: generateValueTypeFile(type, pkg),
        type: 'type',
      });
    }
  }

  // DTOs for behavior input/output
  for (const behavior of domain.behaviors) {
    files.push({
      path: `src/main/kotlin/${pkgPath}/dto/${behavior.name.name}Dto.kt`,
      content: generateBehaviorDto(behavior, domain, pkg),
      type: 'behavior',
    });
  }

  // Repository interfaces
  for (const entity of domain.entities) {
    files.push({
      path: `src/main/kotlin/${pkgPath}/repositories/${entity.name.name}Repository.kt`,
      content: generateRepository(entity, pkg),
      type: 'service',
    });
  }

  // Service interface + impl
  files.push({
    path: `src/main/kotlin/${pkgPath}/services/${domain.name.name}Service.kt`,
    content: generateServiceInterface(domain, pkg),
    type: 'service',
  });

  files.push({
    path: `src/main/kotlin/${pkgPath}/services/${domain.name.name}ServiceImpl.kt`,
    content: generateServiceImpl(domain, pkg),
    type: 'service',
  });

  // Controller
  files.push({
    path: `src/main/kotlin/${pkgPath}/controllers/${domain.name.name}Controller.kt`,
    content: generateKotlinSpringController(domain, pkg),
    type: 'controller',
  });

  // Test file
  files.push({
    path: `src/test/kotlin/${pkgPath}/${domain.name.name}ApplicationTests.kt`,
    content: generateApplicationTest(pkg, domain.name.name),
    type: 'config',
  });

  files.push({
    path: `src/test/kotlin/${pkgPath}/controllers/${domain.name.name}ControllerTest.kt`,
    content: generateControllerTest(domain, pkg),
    type: 'config',
  });

  return files;
}

// ============================================================================
// BUILD FILES
// ============================================================================

function generateBuildGradle(
  springBootVersion: string,
  kotlinVersion: string,
  groupId: string,
  artifactId: string,
  javaVersion: number
): string {
  return `import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("org.springframework.boot") version "${springBootVersion}"
    id("io.spring.dependency-management") version "1.1.4"
    kotlin("jvm") version "${kotlinVersion}"
    kotlin("plugin.spring") version "${kotlinVersion}"
    kotlin("plugin.jpa") version "${kotlinVersion}"
}

group = "${groupId}"
version = "0.0.1-SNAPSHOT"

java {
    sourceCompatibility = JavaVersion.VERSION_${javaVersion}
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    runtimeOnly("com.h2database:h2")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
        jvmTarget = "${javaVersion}"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
`;
}

function generateSettingsGradle(artifactId: string): string {
  return `rootProject.name = "${artifactId}"
`;
}

function generateGradleProperties(kotlinVersion: string): string {
  return `kotlin.code.style=official
org.gradle.jvmargs=-Xmx512m
`;
}

function generateGradleWrapperProperties(): string {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
}

// ============================================================================
// APPLICATION FILES
// ============================================================================

function generateApplicationKt(pkg: string, domainName: string): string {
  return `package ${pkg}

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class ${domainName}Application

fun main(args: Array<String>) {
    runApplication<${domainName}Application>(*args)
}
`;
}

function generateApplicationProperties(artifactId: string): string {
  return `spring.application.name=${artifactId}
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
`;
}

// ============================================================================
// JPA ENTITY GENERATION
// ============================================================================

function generateJpaEntity(entity: Entity, pkg: string): string {
  const name = entity.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.entities`);
  lines.push('');
  lines.push('import jakarta.persistence.*');
  lines.push('import jakarta.validation.constraints.*');
  lines.push('import java.util.UUID');
  lines.push('import java.time.Instant');

  // Import model types
  lines.push(`import ${pkg}.model.*`);
  lines.push('');

  lines.push(`@Entity`);
  lines.push(`@Table(name = "${toSnakeCase(name)}s")`);
  lines.push(`class ${name}(`);

  const fieldLines = entity.fields.map((field, idx) => {
    const annotations = generateJpaFieldAnnotations(field);
    const type = kotlinEntityFieldType(field);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < entity.fields.length - 1 ? ',' : '';
    const defaultValue = getFieldDefault(field);
    return `${annotations}    var ${fieldName}: ${type}${defaultValue}${comma}`;
  });

  lines.push(fieldLines.join('\n'));
  lines.push(')');

  return lines.join('\n');
}

function generateJpaFieldAnnotations(field: Field): string {
  const annotations: string[] = [];
  const name = field.name.name;

  if (name === 'id') {
    annotations.push('    @Id');
    // Check if type is UUID
    if (field.type.kind === 'PrimitiveType' && field.type.name === 'UUID') {
      annotations.push('    @GeneratedValue(strategy = GenerationType.UUID)');
    }
  }

  // Column annotations
  const columnParams: string[] = [];
  for (const ann of field.annotations) {
    switch (ann.name.name) {
      case 'unique':
        columnParams.push('unique = true');
        break;
      case 'indexed':
        // handled separately
        break;
    }
  }

  // Check type constraints for column length
  if (field.type.kind === 'ConstrainedType') {
    for (const c of field.type.constraints) {
      if (c.name === 'max_length' && c.value.kind === 'NumberLiteral') {
        columnParams.push(`length = ${c.value.value}`);
      }
    }
  }

  if (columnParams.length > 0) {
    annotations.push(`    @Column(${columnParams.join(', ')})`);
  }

  // Validation annotations
  if (!field.optional) {
    if (field.type.kind === 'PrimitiveType' && field.type.name === 'String') {
      annotations.push('    @field:NotBlank');
    } else if (name !== 'id') {
      annotations.push('    @field:NotNull');
    }
  }

  if (field.type.kind === 'ConstrainedType') {
    for (const c of field.type.constraints) {
      if (c.name === 'min_length' && c.value.kind === 'NumberLiteral') {
        annotations.push(`    @field:Size(min = ${c.value.value})`);
      }
      if (c.name === 'max_length' && c.value.kind === 'NumberLiteral') {
        annotations.push(`    @field:Size(max = ${c.value.value})`);
      }
    }
  }

  // Enumerated type
  if (field.type.kind === 'ReferenceType') {
    // If it references an enum, add @Enumerated
    annotations.push('    @Enumerated(EnumType.STRING)');
  }

  if (annotations.length === 0) return '';
  return annotations.join('\n') + '\n';
}

function kotlinEntityFieldType(field: Field): string {
  const base = kotlinEntityTypeFromDef(field.type);
  return field.optional ? `${base}?` : base;
}

function kotlinEntityTypeFromDef(def: import('../../../../master_contracts/ast').TypeDefinition): string {
  switch (def.kind) {
    case 'PrimitiveType':
      switch (def.name) {
        case 'String': return 'String';
        case 'Int': return 'Int';
        case 'Decimal': return 'java.math.BigDecimal';
        case 'Boolean': return 'Boolean';
        case 'Timestamp': return 'Instant';
        case 'UUID': return 'UUID';
        case 'Duration': return 'java.time.Duration';
        default: return 'Any';
      }
    case 'ListType':
      return `List<${kotlinEntityTypeFromDef(def.element)}>`;
    case 'MapType':
      return `Map<${kotlinEntityTypeFromDef(def.key)}, ${kotlinEntityTypeFromDef(def.value)}>`;
    case 'OptionalType':
      return `${kotlinEntityTypeFromDef(def.inner)}?`;
    case 'ReferenceType':
      return def.name.parts.map(p => p.name).join('.');
    case 'ConstrainedType':
      return kotlinEntityTypeFromDef(def.base);
    default:
      return 'Any';
  }
}

function getFieldDefault(field: Field): string {
  const name = field.name.name;
  if (field.optional) return ' = null';
  if (name === 'id' && field.type.kind === 'PrimitiveType' && field.type.name === 'UUID') {
    return ' = UUID.randomUUID()';
  }
  if (name.includes('created') || name === 'createdAt' || name === 'created_at') {
    return ' = Instant.now()';
  }
  if (name.includes('updated') || name === 'updatedAt' || name === 'updated_at') {
    return ' = Instant.now()';
  }
  return '';
}

// ============================================================================
// ENUM / VALUE TYPE FILES
// ============================================================================

function generateEnumFile(
  type: import('../../../../master_contracts/ast').TypeDeclaration,
  pkg: string
): string {
  const def = type.definition;
  if (def.kind !== 'EnumType') return '';
  const name = type.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.model`);
  lines.push('');
  lines.push(`enum class ${name} {`);

  const variants = def.variants.map((v, idx) => {
    const comma = idx < def.variants.length - 1 ? ',' : '';
    return `    ${v.name.name}${comma}`;
  });

  lines.push(variants.join('\n'));
  lines.push('}');

  return lines.join('\n');
}

function generateValueTypeFile(
  type: import('../../../../master_contracts/ast').TypeDeclaration,
  pkg: string
): string {
  const name = type.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.model`);
  lines.push('');

  if (type.definition.kind === 'ConstrainedType') {
    const baseType = kotlinEntityTypeFromDef(type.definition.base);
    lines.push(`@JvmInline`);
    lines.push(`value class ${name}(val value: ${baseType}) {`);
    lines.push('    init {');
    for (const c of type.definition.constraints) {
      if (c.name === 'format' && c.value.kind === 'RegexLiteral') {
        const pattern = escapeKotlinString(c.value.pattern);
        lines.push(`        require(value.matches(Regex("${pattern}"))) { "Invalid ${name} format" }`);
      }
      if (c.name === 'min_length' && c.value.kind === 'NumberLiteral') {
        lines.push(`        require(value.length >= ${c.value.value}) { "${name} must be at least ${c.value.value} characters" }`);
      }
      if (c.name === 'max_length' && c.value.kind === 'NumberLiteral') {
        lines.push(`        require(value.length <= ${c.value.value}) { "${name} must be at most ${c.value.value} characters" }`);
      }
    }
    lines.push('    }');
    lines.push('}');
  } else {
    const baseType = kotlinEntityTypeFromDef(type.definition);
    lines.push(`typealias ${name} = ${baseType}`);
  }

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR DTOs
// ============================================================================

function generateBehaviorDto(behavior: Behavior, _domain: Domain, pkg: string): string {
  const name = behavior.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.dto`);
  lines.push('');
  lines.push('import jakarta.validation.constraints.*');
  lines.push('import java.util.UUID');
  lines.push(`import ${pkg}.model.*`);
  lines.push('');

  // Input DTO
  lines.push(`data class ${name}Request(`);
  const inputFields = behavior.input.fields.map((field, idx) => {
    const type = kotlinEntityFieldType(field);
    const fieldName = toCamelCase(field.name.name);
    const comma = idx < behavior.input.fields.length - 1 ? ',' : '';
    const validation = !field.optional ? '    @field:NotNull\n' : '';
    return `${validation}    val ${fieldName}: ${type}${comma}`;
  });
  lines.push(inputFields.join('\n'));
  lines.push(')');
  lines.push('');

  // Response DTO
  const successType = kotlinEntityTypeFromDef(behavior.output.success);
  if (successType !== 'Boolean') {
    lines.push(`data class ${name}Response(`);
    // For struct success types, just wrap as generic
    lines.push(`    val data: Any,`);
    lines.push(`    val success: Boolean = true`);
    lines.push(')');
    lines.push('');
  }

  // Error response
  lines.push(`data class ${name}ErrorResponse(`);
  lines.push('    val error: String,');
  lines.push('    val message: String,');
  lines.push('    val retriable: Boolean = false');
  lines.push(')');

  return lines.join('\n');
}

// ============================================================================
// REPOSITORY
// ============================================================================

function generateRepository(entity: Entity, pkg: string): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Determine ID type
  const idField = entity.fields.find(f => f.name.name === 'id');
  const idType = idField ? kotlinEntityTypeFromDef(idField.type) : 'UUID';

  lines.push(`package ${pkg}.repositories`);
  lines.push('');
  lines.push(`import ${pkg}.entities.${name}`);
  lines.push('import org.springframework.data.jpa.repository.JpaRepository');
  lines.push('import org.springframework.stereotype.Repository');
  lines.push('import java.util.UUID');
  lines.push('');

  lines.push(`@Repository`);
  lines.push(`interface ${name}Repository : JpaRepository<${name}, ${idType}>`);

  return lines.join('\n');
}

// ============================================================================
// SERVICE INTERFACE + IMPL
// ============================================================================

function generateServiceInterface(domain: Domain, pkg: string): string {
  const name = domain.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.services`);
  lines.push('');
  lines.push(`import ${pkg}.dto.*`);
  lines.push(`import ${pkg}.entities.*`);
  lines.push('import java.util.UUID');
  lines.push('');

  lines.push(`interface ${name}Service {`);

  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const inputType = `${behavior.name.name}Request`;
    const successType = kotlinEntityTypeFromDef(behavior.output.success);
    const returnType = successType === 'Boolean' ? 'Boolean' : 'Any';
    lines.push(`    fun ${methodName}(request: ${inputType}): ${returnType}`);
  }

  // CRUD for entities
  for (const entity of domain.entities) {
    const eName = entity.name.name;
    lines.push(`    fun findAll${eName}s(): List<${eName}>`);
    lines.push(`    fun find${eName}ById(id: UUID): ${eName}?`);
    lines.push(`    fun delete${eName}ById(id: UUID)`);
  }

  lines.push('}');
  return lines.join('\n');
}

function generateServiceImpl(domain: Domain, pkg: string): string {
  const name = domain.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.services`);
  lines.push('');
  lines.push(`import ${pkg}.dto.*`);
  lines.push(`import ${pkg}.entities.*`);
  lines.push(`import ${pkg}.repositories.*`);
  lines.push('import org.springframework.stereotype.Service');
  lines.push('import java.util.UUID');
  lines.push('');

  // Collect repositories needed
  const repos = domain.entities.map(e => {
    const repoName = `${toCamelCase(e.name.name)}Repository`;
    return { name: repoName, type: `${e.name.name}Repository` };
  });

  lines.push(`@Service`);
  lines.push(`class ${name}ServiceImpl(`);
  const repoParams = repos.map((r, idx) => {
    const comma = idx < repos.length - 1 ? ',' : '';
    return `    private val ${r.name}: ${r.type}${comma}`;
  });
  lines.push(repoParams.join('\n'));
  lines.push(`) : ${name}Service {`);
  lines.push('');

  // Behavior methods - generate TODO stubs
  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const inputType = `${behavior.name.name}Request`;
    const successType = kotlinEntityTypeFromDef(behavior.output.success);
    const returnType = successType === 'Boolean' ? 'Boolean' : 'Any';
    lines.push(`    override fun ${methodName}(request: ${inputType}): ${returnType} {`);
    lines.push(`        TODO("Implement ${behavior.name.name} business logic")`);
    lines.push(`    }`);
    lines.push('');
  }

  // CRUD methods
  for (const entity of domain.entities) {
    const eName = entity.name.name;
    const repoVar = `${toCamelCase(eName)}Repository`;

    lines.push(`    override fun findAll${eName}s(): List<${eName}> {`);
    lines.push(`        return ${repoVar}.findAll()`);
    lines.push(`    }`);
    lines.push('');

    lines.push(`    override fun find${eName}ById(id: UUID): ${eName}? {`);
    lines.push(`        return ${repoVar}.findById(id).orElse(null)`);
    lines.push(`    }`);
    lines.push('');

    lines.push(`    override fun delete${eName}ById(id: UUID) {`);
    lines.push(`        ${repoVar}.deleteById(id)`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// SPRING CONTROLLER (KOTLIN)
// ============================================================================

function generateKotlinSpringController(domain: Domain, pkg: string): string {
  const name = domain.name.name;
  const serviceName = `${name}Service`;
  const serviceVar = toCamelCase(serviceName);
  const lines: string[] = [];

  lines.push(`package ${pkg}.controllers`);
  lines.push('');
  lines.push(`import ${pkg}.dto.*`);
  lines.push(`import ${pkg}.entities.*`);
  lines.push(`import ${pkg}.services.${serviceName}`);
  lines.push('import org.springframework.http.ResponseEntity');
  lines.push('import org.springframework.web.bind.annotation.*');
  lines.push('import jakarta.validation.Valid');
  lines.push('import java.util.UUID');
  lines.push('');

  lines.push(`@RestController`);
  lines.push(`@RequestMapping("/api/${toKebabCase(name)}")`);
  lines.push(`class ${name}Controller(`);
  lines.push(`    private val ${serviceVar}: ${serviceName}`);
  lines.push(') {');
  lines.push('');

  // Behavior endpoints
  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const requestType = `${behavior.name.name}Request`;
    const httpMethod = determineHttpMethod(behavior.name.name);
    const path = toKebabCase(behavior.name.name);

    lines.push(`    @${httpMethod}Mapping("/${path}")`);
    lines.push(`    fun ${methodName}(@Valid @RequestBody request: ${requestType}): ResponseEntity<Any> {`);
    lines.push(`        return try {`);
    lines.push(`            val result = ${serviceVar}.${methodName}(request)`);
    lines.push(`            ResponseEntity.ok(result)`);
    lines.push(`        } catch (e: Exception) {`);
    lines.push(`            ResponseEntity.badRequest().body(mapOf("error" to e.message))`);
    lines.push(`        }`);
    lines.push(`    }`);
    lines.push('');
  }

  // Entity CRUD endpoints
  for (const entity of domain.entities) {
    const eName = entity.name.name;
    const ePath = toKebabCase(eName) + 's';

    lines.push(`    @GetMapping("/${ePath}")`);
    lines.push(`    fun getAll${eName}s(): ResponseEntity<List<${eName}>> {`);
    lines.push(`        return ResponseEntity.ok(${serviceVar}.findAll${eName}s())`);
    lines.push(`    }`);
    lines.push('');

    lines.push(`    @GetMapping("/${ePath}/{id}")`);
    lines.push(`    fun get${eName}ById(@PathVariable id: UUID): ResponseEntity<${eName}> {`);
    lines.push(`        return ${serviceVar}.find${eName}ById(id)`);
    lines.push(`            ?.let { ResponseEntity.ok(it) }`);
    lines.push(`            ?: ResponseEntity.notFound().build()`);
    lines.push(`    }`);
    lines.push('');

    lines.push(`    @DeleteMapping("/${ePath}/{id}")`);
    lines.push(`    fun delete${eName}ById(@PathVariable id: UUID): ResponseEntity<Void> {`);
    lines.push(`        ${serviceVar}.delete${eName}ById(id)`);
    lines.push(`        return ResponseEntity.noContent().build()`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// TEST FILES
// ============================================================================

function generateApplicationTest(pkg: string, domainName: string): string {
  return `package ${pkg}

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest

@SpringBootTest
class ${domainName}ApplicationTests {

    @Test
    fun contextLoads() {
    }
}
`;
}

function generateControllerTest(domain: Domain, pkg: string): string {
  const name = domain.name.name;
  const lines: string[] = [];

  lines.push(`package ${pkg}.controllers`);
  lines.push('');
  lines.push('import org.junit.jupiter.api.Test');
  lines.push('import org.springframework.beans.factory.annotation.Autowired');
  lines.push('import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc');
  lines.push('import org.springframework.boot.test.context.SpringBootTest');
  lines.push('import org.springframework.test.web.servlet.MockMvc');
  lines.push('import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get');
  lines.push('import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status');
  lines.push('');

  lines.push('@SpringBootTest');
  lines.push('@AutoConfigureMockMvc');
  lines.push(`class ${name}ControllerTest {`);
  lines.push('');
  lines.push('    @Autowired');
  lines.push('    lateinit var mockMvc: MockMvc');
  lines.push('');

  // Generate a test for each entity's GET all endpoint
  for (const entity of domain.entities) {
    const ePath = toKebabCase(entity.name.name) + 's';
    lines.push(`    @Test`);
    lines.push(`    fun \`GET ${ePath} returns 200\`() {`);
    lines.push(`        mockMvc.perform(get("/api/${toKebabCase(name)}/${ePath}"))`);
    lines.push(`            .andExpect(status().isOk)`);
    lines.push(`    }`);
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toCamelCase(str: string): string {
  const result = str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return result.charAt(0).toLowerCase() + result.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function determineHttpMethod(behaviorName: string): string {
  const name = behaviorName.toLowerCase();
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('register')) return 'Post';
  if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('modify')) return 'Put';
  if (name.startsWith('delete') || name.startsWith('remove') || name.startsWith('cancel')) return 'Delete';
  if (name.startsWith('get') || name.startsWith('find') || name.startsWith('list') || name.startsWith('search')) return 'Get';
  return 'Post';
}

function escapeKotlinString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
