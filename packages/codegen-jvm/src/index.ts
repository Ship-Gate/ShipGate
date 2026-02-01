// ============================================================================
// ISL JVM Code Generator - Entry Point
// Generates idiomatic Java and Kotlin code from ISL specifications
// ============================================================================

export { generate, GeneratorOptions, GeneratedFile } from './generator';
export { generateJavaTypes } from './java/types';
export { generateJavaRecords } from './java/records';
export { generateJavaInterfaces } from './java/interfaces';
export { generateJavaValidation } from './java/validation';
export { generateSpringController } from './java/spring';
export { generateKotlinTypes } from './kotlin/types';
export { generateKotlinDataClasses } from './kotlin/dataclass';
export { generateKotlinSealed } from './kotlin/sealed';
export { generateKotlinCoroutines } from './kotlin/coroutines';
