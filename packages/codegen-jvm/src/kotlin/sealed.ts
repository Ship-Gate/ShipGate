// ============================================================================
// ISL JVM Code Generator - Kotlin Sealed Classes
// ============================================================================

import type {
  Behavior,
  TypeDefinition,
  ErrorSpec,
  Field,
} from '../../../../master_contracts/ast';
import type { GeneratorOptions } from '../generator';
import { kotlinTypeFromDef } from './types';

// ============================================================================
// SEALED CLASS FOR BEHAVIOR RESULT
// ============================================================================

export function generateKotlinSealed(
  behavior: Behavior,
  options: GeneratorOptions
): string {
  const name = behavior.name.name;
  const lines: string[] = [];

  // Generate KDoc
  lines.push('/**');
  lines.push(` * Result type for ${name} behavior.`);
  lines.push(' * Sealed class representing either success or one of the possible errors.');
  lines.push(' */');

  // Generate sealed class
  lines.push(`sealed class ${name}Result {`);

  // Success case
  const successType = kotlinTypeFromDef(behavior.output.success);
  lines.push('    /**');
  lines.push('     * Successful result.');
  lines.push('     */');
  lines.push(`    data class Success(val value: ${successType}) : ${name}Result()`);
  lines.push('');

  // Error cases
  for (const error of behavior.output.errors) {
    const errorName = toPascalCase(error.name.name);
    
    // Add KDoc for error
    lines.push('    /**');
    if (error.when) {
      lines.push(`     * Error: ${error.when.value}`);
    } else {
      lines.push(`     * Error: ${errorName}`);
    }
    if (error.retriable) {
      lines.push('     * This error is retriable.');
    }
    lines.push('     */');

    if (error.returns) {
      const returnType = kotlinTypeFromDef(error.returns);
      lines.push(`    data class ${errorName}(val details: ${returnType}) : ${name}Result()`);
    } else {
      lines.push(`    data object ${errorName} : ${name}Result()`);
    }
    lines.push('');
  }

  // Extension functions for result handling
  lines.push(generateResultExtensions(name, behavior.output.success, behavior.output.errors));

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// RESULT EXTENSION FUNCTIONS
// ============================================================================

function generateResultExtensions(
  name: string,
  successType: TypeDefinition,
  errors: ErrorSpec[]
): string {
  const lines: string[] = [];
  const successKotlinType = kotlinTypeFromDef(successType);

  lines.push('    // Extension functions for result handling');
  lines.push('');

  // isSuccess
  lines.push('    fun isSuccess(): Boolean = this is Success');
  lines.push('');

  // isError
  lines.push('    fun isError(): Boolean = this !is Success');
  lines.push('');

  // getOrNull
  lines.push(`    fun getOrNull(): ${successKotlinType}? = (this as? Success)?.value`);
  lines.push('');

  // getOrThrow
  lines.push(`    fun getOrThrow(): ${successKotlinType} = when (this) {`);
  lines.push('        is Success -> value');
  for (const error of errors) {
    const errorName = toPascalCase(error.name.name);
    lines.push(`        is ${errorName} -> throw ${name}Exception.${errorName}()`);
  }
  lines.push('    }');
  lines.push('');

  // fold
  lines.push(`    inline fun <R> fold(`);
  lines.push(`        onSuccess: (${successKotlinType}) -> R,`);
  lines.push(`        onError: (${name}Result) -> R`);
  lines.push(`    ): R = when (this) {`);
  lines.push('        is Success -> onSuccess(value)');
  lines.push('        else -> onError(this)');
  lines.push('    }');
  lines.push('');

  // map
  lines.push(`    inline fun <R> map(transform: (${successKotlinType}) -> R): ${name}Result =`);
  lines.push('        when (this) {');
  lines.push(`            is Success -> Success(transform(value) as ${successKotlinType})`);
  lines.push('            else -> this');
  lines.push('        }');

  return lines.join('\n');
}

// ============================================================================
// EXCEPTION CLASSES
// ============================================================================

export function generateKotlinExceptions(
  behavior: Behavior,
  options: GeneratorOptions
): string {
  const name = behavior.name.name;
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Exception types for ${name} behavior errors.`);
  lines.push(' */');
  lines.push(`sealed class ${name}Exception(message: String) : Exception(message) {`);

  for (const error of behavior.output.errors) {
    const errorName = toPascalCase(error.name.name);
    const message = error.when?.value ?? errorName;

    if (error.returns) {
      const returnType = kotlinTypeFromDef(error.returns);
      lines.push(`    class ${errorName}(val details: ${returnType}? = null) : ${name}Exception("${message}")`);
    } else {
      lines.push(`    class ${errorName} : ${name}Exception("${message}")`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// RESULT BUILDERS
// ============================================================================

export function generateResultBuilders(
  behavior: Behavior,
  options: GeneratorOptions
): string {
  const name = behavior.name.name;
  const lines: string[] = [];
  const successType = kotlinTypeFromDef(behavior.output.success);

  lines.push('// Result builders');
  lines.push('');

  // Success builder
  lines.push(`fun ${toCamelCase(name)}Success(value: ${successType}): ${name}Result =`);
  lines.push(`    ${name}Result.Success(value)`);
  lines.push('');

  // Error builders
  for (const error of behavior.output.errors) {
    const errorName = toPascalCase(error.name.name);
    const builderName = `${toCamelCase(name)}${errorName}`;

    if (error.returns) {
      const returnType = kotlinTypeFromDef(error.returns);
      lines.push(`fun ${builderName}(details: ${returnType}): ${name}Result =`);
      lines.push(`    ${name}Result.${errorName}(details)`);
    } else {
      lines.push(`fun ${builderName}(): ${name}Result =`);
      lines.push(`    ${name}Result.${errorName}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// UNION TYPE SEALED CLASS
// ============================================================================

export function generateKotlinUnionSealed(
  name: string,
  variants: { name: string; fields: Field[] }[],
  options: GeneratorOptions
): string {
  const lines: string[] = [];

  lines.push(`sealed class ${name} {`);

  for (const variant of variants) {
    if (variant.fields.length === 0) {
      lines.push(`    data object ${variant.name} : ${name}()`);
    } else {
      lines.push(`    data class ${variant.name}(`);
      const fieldLines = variant.fields.map((field, idx) => {
        const type = kotlinFieldType(field);
        const fieldName = toCamelCase(field.name.name);
        const comma = idx < variant.fields.length - 1 ? ',' : '';
        return `        val ${fieldName}: ${type}${comma}`;
      });
      lines.push(fieldLines.join('\n'));
      lines.push(`    ) : ${name}()`);
    }
    lines.push('');
  }

  // Generate when-exhaustive helper
  lines.push('    companion object {');
  lines.push(`        inline fun <R> ${name}.exhaustive(block: ${name}.() -> R): R = block()`);
  lines.push('    }');

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function kotlinFieldType(field: Field): string {
  const base = kotlinTypeFromDef(field.type);
  return field.optional ? `${base}?` : base;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}
