// ============================================================================
// ISL JVM Code Generator - Kotlin Coroutines Support
// ============================================================================

import type {
  Domain,
  Behavior,
  Entity,
} from '../../../../master_contracts/ast';
import type { GeneratorOptions } from '../generator';
import { kotlinTypeFromDef } from './types';

// ============================================================================
// SERVICE INTERFACE WITH COROUTINES
// ============================================================================

export function generateKotlinCoroutines(
  domain: Domain,
  options: GeneratorOptions
): string {
  const serviceName = `${domain.name.name}Service`;
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.behaviors.*`);
  lines.push('import kotlinx.coroutines.flow.Flow');
  lines.push('import java.util.UUID');
  lines.push('');

  // Interface KDoc
  lines.push('/**');
  lines.push(` * Service interface for ${domain.name.name} domain.`);
  lines.push(' * Uses Kotlin coroutines for async operations.');
  lines.push(' */');

  // Interface declaration
  lines.push(`interface ${serviceName} {`);
  lines.push('');

  // Generate suspend functions for behaviors
  for (const behavior of domain.behaviors) {
    const methodName = toCamelCase(behavior.name.name);
    const inputType = `${behavior.name.name}Input`;
    const resultType = `${behavior.name.name}Result`;

    // Method KDoc
    if (behavior.description) {
      lines.push('    /**');
      lines.push(`     * ${behavior.description.value}`);
      lines.push('     */');
    }

    lines.push(`    suspend fun ${methodName}(input: ${inputType}): ${resultType}`);
    lines.push('');
  }

  // Generate CRUD methods for entities
  for (const entity of domain.entities) {
    lines.push(generateEntityMethods(entity, options));
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// ENTITY CRUD METHODS
// ============================================================================

function generateEntityMethods(entity: Entity, _options: GeneratorOptions): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Find by ID
  lines.push(`    suspend fun find${name}ById(id: UUID): ${name}?`);
  lines.push('');

  // Find all with Flow
  lines.push(`    fun findAll${name}s(): Flow<${name}>`);
  lines.push('');

  // Save
  lines.push(`    suspend fun save${name}(entity: ${name}): ${name}`);
  lines.push('');

  // Delete
  lines.push(`    suspend fun delete${name}ById(id: UUID)`);

  return lines.join('\n');
}

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export function generateKotlinRepository(
  entity: Entity,
  options: GeneratorOptions
): string {
  const name = entity.name.name;
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.repositories`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.${name}`);
  lines.push('import kotlinx.coroutines.flow.Flow');
  lines.push('import java.util.UUID');
  lines.push('');

  // Interface declaration
  lines.push(`interface ${name}Repository {`);
  lines.push('');

  // Find by ID
  lines.push(`    suspend fun findById(id: UUID): ${name}?`);
  lines.push('');

  // Find all
  lines.push(`    fun findAll(): Flow<${name}>`);
  lines.push('');

  // Find by unique fields
  const uniqueFields = entity.fields.filter(f =>
    f.annotations.some(a => a.name.name === 'unique') && f.name.name !== 'id'
  );

  for (const field of uniqueFields) {
    const fieldName = toPascalCase(field.name.name);
    const fieldType = kotlinTypeFromDef(field.type);
    const paramName = toCamelCase(field.name.name);

    lines.push(`    suspend fun findBy${fieldName}(${paramName}: ${fieldType}): ${name}?`);
    lines.push('');
  }

  // Save
  lines.push(`    suspend fun save(entity: ${name}): ${name}`);
  lines.push('');

  // Delete
  lines.push(`    suspend fun deleteById(id: UUID)`);

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// USE CASE GENERATION
// ============================================================================

export function generateKotlinUseCase(
  behavior: Behavior,
  domain: Domain,
  options: GeneratorOptions
): string {
  const name = behavior.name.name;
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.usecases`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.behaviors.*`);
  lines.push(`import ${options.package}.${domain.name.name}Service`);
  lines.push('import javax.inject.Inject');
  lines.push('');

  // Class declaration
  lines.push('/**');
  if (behavior.description) {
    lines.push(` * ${behavior.description.value}`);
  }
  lines.push(' */');
  lines.push(`class ${name}UseCase @Inject constructor(`);
  lines.push(`    private val service: ${domain.name.name}Service`);
  lines.push(') {');
  lines.push('');

  // Invoke operator
  lines.push(`    suspend operator fun invoke(input: ${name}Input): ${name}Result {`);
  lines.push(`        return service.${toCamelCase(name)}(input)`);
  lines.push('    }');

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// FLOW OPERATORS
// ============================================================================

export function generateFlowOperators(
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`package ${options.package}.extensions`);
  lines.push('');
  lines.push('import kotlinx.coroutines.flow.*');
  lines.push('');

  lines.push('// Flow extension functions');
  lines.push('');

  // Result flow mapping
  for (const behavior of domain.behaviors) {
    const name = behavior.name.name;
    const resultType = `${name}Result`;
    const successType = kotlinTypeFromDef(behavior.output.success);

    lines.push(`/**`);
    lines.push(` * Maps successful ${name} results.`);
    lines.push(` */`);
    lines.push(`fun Flow<${resultType}>.mapSuccess(): Flow<${successType}> = this`);
    lines.push(`    .filterIsInstance<${resultType}.Success>()`);
    lines.push(`    .map { it.value }`);
    lines.push('');

    lines.push(`/**`);
    lines.push(` * Filters failed ${name} results.`);
    lines.push(` */`);
    lines.push(`fun Flow<${resultType}>.filterErrors(): Flow<${resultType}> = this`);
    lines.push(`    .filter { it !is ${resultType}.Success }`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// DISPATCHER CONFIGURATION
// ============================================================================

export function generateDispatcherConfig(options: GeneratorOptions): string {
  const lines: string[] = [];

  lines.push(`package ${options.package}.config`);
  lines.push('');
  lines.push('import kotlinx.coroutines.CoroutineDispatcher');
  lines.push('import kotlinx.coroutines.Dispatchers');
  lines.push('import kotlinx.coroutines.asCoroutineDispatcher');
  lines.push('import java.util.concurrent.Executors');
  lines.push('');

  lines.push('/**');
  lines.push(' * Coroutine dispatcher configuration.');
  lines.push(' */');
  lines.push('object CoroutineDispatchers {');
  lines.push('    /**');
  lines.push('     * Dispatcher for IO operations (database, network).');
  lines.push('     */');
  lines.push('    val io: CoroutineDispatcher = Dispatchers.IO');
  lines.push('');
  lines.push('    /**');
  lines.push('     * Dispatcher for CPU-intensive operations.');
  lines.push('     */');
  lines.push('    val computation: CoroutineDispatcher = Dispatchers.Default');
  lines.push('');
  lines.push('    /**');
  lines.push('     * Dispatcher for database operations with limited parallelism.');
  lines.push('     */');
  lines.push('    val database: CoroutineDispatcher = Executors');
  lines.push('        .newFixedThreadPool(4)');
  lines.push('        .asCoroutineDispatcher()');
  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// SUSPEND WRAPPER
// ============================================================================

export function generateSuspendWrapper(options: GeneratorOptions): string {
  const lines: string[] = [];

  lines.push(`package ${options.package}.extensions`);
  lines.push('');
  lines.push('import kotlinx.coroutines.*');
  lines.push('import kotlin.coroutines.CoroutineContext');
  lines.push('');

  lines.push('/**');
  lines.push(' * Extension functions for converting blocking calls to suspend functions.');
  lines.push(' */');
  lines.push('');

  // suspendBlocking
  lines.push('/**');
  lines.push(' * Runs a blocking operation on IO dispatcher.');
  lines.push(' */');
  lines.push('suspend fun <T> suspendBlocking(block: () -> T): T =');
  lines.push('    withContext(Dispatchers.IO) { block() }');
  lines.push('');

  // retry with delay
  lines.push('/**');
  lines.push(' * Retries a suspend function with exponential backoff.');
  lines.push(' */');
  lines.push('suspend fun <T> retry(');
  lines.push('    times: Int = 3,');
  lines.push('    initialDelay: Long = 100,');
  lines.push('    maxDelay: Long = 1000,');
  lines.push('    factor: Double = 2.0,');
  lines.push('    block: suspend () -> T');
  lines.push('): T {');
  lines.push('    var currentDelay = initialDelay');
  lines.push('    repeat(times - 1) {');
  lines.push('        try {');
  lines.push('            return block()');
  lines.push('        } catch (e: Exception) {');
  lines.push('            delay(currentDelay)');
  lines.push('            currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelay)');
  lines.push('        }');
  lines.push('    }');
  lines.push('    return block()');
  lines.push('}');
  lines.push('');

  // Timeout wrapper
  lines.push('/**');
  lines.push(' * Wraps a suspend function with timeout.');
  lines.push(' */');
  lines.push('suspend fun <T> withTimeoutOrNull(');
  lines.push('    timeMillis: Long,');
  lines.push('    block: suspend () -> T');
  lines.push('): T? = kotlinx.coroutines.withTimeoutOrNull(timeMillis) { block() }');

  return lines.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
