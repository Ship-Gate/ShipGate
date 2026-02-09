// ============================================================================
// ISL JVM Code Generator - Entry Point
// Generates idiomatic Java and Kotlin code from ISL specifications
// ============================================================================

export { generate } from './generator.js';
export type { GeneratorOptions, GeneratedFile } from './generator.js';
export { generateJavaTypes } from './java/types.js';
export { generateJavaRecords } from './java/records.js';
export { generateJavaInterfaces } from './java/interfaces.js';
export { generateJavaValidation } from './java/validation.js';
export { generateSpringController } from './java/spring.js';
export { generateKotlinTypes } from './kotlin/types.js';
export { generateKotlinDataClasses } from './kotlin/dataclass.js';
export { generateKotlinSealed } from './kotlin/sealed.js';
export { generateKotlinCoroutines } from './kotlin/coroutines.js';
