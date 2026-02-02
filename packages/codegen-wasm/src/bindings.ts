// ============================================================================
// Host Bindings Generator
// Generates JavaScript/TypeScript bindings for WebAssembly modules
// ============================================================================

// ============================================================================
// LOCAL TYPES (simplified ISL AST types for binding generation)
// ============================================================================

/**
 * Identifier node
 */
interface Identifier {
  name: string;
}

/**
 * String literal node
 */
interface StringLiteral {
  value: string;
}

/**
 * Field definition
 */
interface FieldDefinition {
  name: Identifier;
  type: TypeDefinition;
  optional?: boolean;
}

/**
 * Error reference
 */
interface ErrorReference {
  name: Identifier;
}

/**
 * Output block
 */
interface OutputBlock {
  success: TypeDefinition;
  errors: ErrorReference[];
}

/**
 * Input block
 */
interface InputBlock {
  fields: FieldDefinition[];
}

/**
 * Type definition (discriminated union)
 */
type TypeDefinition =
  | { kind: 'PrimitiveType'; name: string }
  | { kind: 'ReferenceType'; name: { parts: Identifier[] } }
  | { kind: 'ListType'; element: TypeDefinition }
  | { kind: 'MapType'; key: TypeDefinition; value: TypeDefinition }
  | { kind: 'OptionalType'; inner: TypeDefinition }
  | { kind: 'EnumType'; variants: Identifier[] };

/**
 * Entity definition
 */
interface Entity {
  name: Identifier;
  fields: FieldDefinition[];
}

/**
 * Behavior definition
 */
interface Behavior {
  name: Identifier;
  description?: StringLiteral;
  input: InputBlock;
  output: OutputBlock;
}

/**
 * Domain definition
 */
interface Domain {
  name: Identifier;
  entities: Entity[];
  behaviors: Behavior[];
}

// ============================================================================
// TYPES
// ============================================================================

export interface BindingsOptions {
  language: 'typescript' | 'javascript';
  style: 'class' | 'functional';
  asyncify?: boolean;
  includeHelpers?: boolean;
}

export interface GeneratedBindings {
  code: string;
  types?: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate host bindings for a WebAssembly module
 */
export function generateBindings(
  domain: Domain,
  options: BindingsOptions = { language: 'typescript', style: 'class' }
): GeneratedBindings {
  if (options.language === 'typescript') {
    return generateTypeScriptBindings(domain, options);
  }
  return generateJavaScriptBindings(domain, options);
}

// ============================================================================
// TYPESCRIPT BINDINGS
// ============================================================================

function generateTypeScriptBindings(
  domain: Domain,
  options: BindingsOptions
): GeneratedBindings {
  const lines: string[] = [];
  const name = domain.name.name;

  // Header
  lines.push('// ============================================================================');
  lines.push(`// ${name} WebAssembly Bindings`);
  lines.push('// Auto-generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  // Imports
  lines.push("import type { WasmExports, WasmInstance } from '@isl-lang/codegen-wasm';");
  lines.push('');

  // Types for entities
  lines.push('// Entity Types');
  for (const entity of domain.entities) {
    lines.push(generateEntityInterface(entity));
  }
  lines.push('');

  // Input/Output types for behaviors
  lines.push('// Behavior Types');
  for (const behavior of domain.behaviors) {
    lines.push(generateBehaviorTypes(behavior));
  }
  lines.push('');

  // Error types
  lines.push('// Error Types');
  lines.push(generateErrorTypes(domain));
  lines.push('');

  // Runtime class or functions
  if (options.style === 'class') {
    lines.push(generateRuntimeClass(domain, options));
  } else {
    lines.push(generateRuntimeFunctions(domain, options));
  }

  // Helper functions
  if (options.includeHelpers !== false) {
    lines.push('');
    lines.push(generateHelperFunctions());
  }

  return { code: lines.join('\n') };
}

function generateEntityInterface(entity: Entity): string {
  const lines: string[] = [];
  const name = entity.name.name;

  lines.push(`export interface ${name} {`);
  for (const field of entity.fields) {
    const tsType = islTypeToTS(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateBehaviorTypes(behavior: Behavior): string {
  const lines: string[] = [];
  const name = behavior.name.name;

  // Input type
  lines.push(`export interface ${name}Input {`);
  for (const field of behavior.input.fields) {
    const tsType = islTypeToTS(field.type);
    const optional = field.optional ? '?' : '';
    lines.push(`  ${field.name.name}${optional}: ${tsType};`);
  }
  lines.push('}');
  lines.push('');

  // Output type
  const outputType = islTypeToTS(behavior.output.success);
  const errorTypes = behavior.output.errors.map((e: ErrorReference) => `'${e.name.name}'`).join(' | ');
  
  lines.push(`export type ${name}Result =`);
  lines.push(`  | { success: true; data: ${outputType} }`);
  if (behavior.output.errors.length > 0) {
    lines.push(`  | { success: false; error: ${errorTypes}; message?: string };`);
  } else {
    lines.push(`  | { success: false; error: string; message?: string };`);
  }
  lines.push('');

  return lines.join('\n');
}

function generateErrorTypes(domain: Domain): string {
  const allErrors = new Set<string>();
  
  for (const behavior of domain.behaviors) {
    for (const error of behavior.output.errors) {
      allErrors.add(error.name.name);
    }
  }

  if (allErrors.size === 0) {
    return "export type DomainError = 'UNKNOWN_ERROR';";
  }

  return `export type DomainError = ${[...allErrors].map((e: string) => `'${e}'`).join(' | ')};`;
}

function generateRuntimeClass(domain: Domain, options: BindingsOptions): string {
  const lines: string[] = [];
  const name = domain.name.name;

  lines.push(`export class ${name}Runtime {`);
  lines.push('  private instance: WebAssembly.Instance | null = null;');
  lines.push('  private memory: WebAssembly.Memory | null = null;');
  lines.push('  private textEncoder = new TextEncoder();');
  lines.push('  private textDecoder = new TextDecoder();');
  lines.push('');

  // Constructor
  lines.push('  constructor() {}');
  lines.push('');

  // Initialize method
  lines.push('  async initialize(wasmPath: string | URL | BufferSource): Promise<void> {');
  lines.push('    const imports = this.createImports();');
  lines.push('');
  lines.push('    if (typeof wasmPath === "string" || wasmPath instanceof URL) {');
  lines.push('      const response = await fetch(wasmPath);');
  lines.push('      const buffer = await response.arrayBuffer();');
  lines.push('      const { instance } = await WebAssembly.instantiate(buffer, imports);');
  lines.push('      this.instance = instance;');
  lines.push('    } else {');
  lines.push('      const { instance } = await WebAssembly.instantiate(wasmPath, imports);');
  lines.push('      this.instance = instance;');
  lines.push('    }');
  lines.push('');
  lines.push('    this.memory = this.instance.exports.memory as WebAssembly.Memory;');
  lines.push('  }');
  lines.push('');

  // Create imports method
  lines.push('  private createImports(): WebAssembly.Imports {');
  lines.push('    return {');
  lines.push('      env: {');
  lines.push('        log: (ptr: number, len: number) => {');
  lines.push('          const message = this.readString(ptr, len);');
  lines.push('          console.log(message);');
  lines.push('        },');
  lines.push('        now: () => BigInt(Date.now()),');
  lines.push('        random: () => Math.random(),');
  lines.push('      },');
  lines.push('      storage: {');
  lines.push('        get: (keyPtr: number, keyLen: number) => {');
  lines.push('          // Override for actual storage implementation');
  lines.push('          return 0;');
  lines.push('        },');
  lines.push('        set: (keyPtr: number, keyLen: number, valPtr: number, valLen: number) => {');
  lines.push('          return 1;');
  lines.push('        },');
  lines.push('        delete: (keyPtr: number, keyLen: number) => {');
  lines.push('          return 1;');
  lines.push('        },');
  lines.push('      },');
  lines.push('    };');
  lines.push('  }');
  lines.push('');

  // Behavior methods
  for (const behavior of domain.behaviors) {
    lines.push(generateBehaviorMethod(behavior, options));
  }

  // Entity factory methods
  for (const entity of domain.entities) {
    lines.push(generateEntityMethods(entity));
  }

  // Memory helpers
  lines.push('  private readString(ptr: number, len: number): string {');
  lines.push('    if (!this.memory) throw new Error("Runtime not initialized");');
  lines.push('    const bytes = new Uint8Array(this.memory.buffer, ptr, len);');
  lines.push('    return this.textDecoder.decode(bytes);');
  lines.push('  }');
  lines.push('');
  lines.push('  private writeString(str: string): number {');
  lines.push('    if (!this.instance || !this.memory) throw new Error("Runtime not initialized");');
  lines.push('    const bytes = this.textEncoder.encode(str);');
  lines.push('    const alloc = this.instance.exports.__alloc as (size: number) => number;');
  lines.push('    const ptr = alloc(bytes.length + 1);');
  lines.push('    new Uint8Array(this.memory.buffer, ptr, bytes.length).set(bytes);');
  lines.push('    return ptr;');
  lines.push('  }');
  lines.push('');

  lines.push('}');

  return lines.join('\n');
}

function generateBehaviorMethod(behavior: Behavior, options: BindingsOptions): string {
  const lines: string[] = [];
  const name = behavior.name.name;
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  const async = options.asyncify ? 'async ' : '';
  const returnType = options.asyncify ? `Promise<${name}Result>` : `${name}Result`;

  // JSDoc
  if (behavior.description) {
    lines.push(`  /** ${behavior.description.value} */`);
  }

  lines.push(`  ${async}${camelName}(input: ${name}Input): ${returnType} {`);
  lines.push('    if (!this.instance) throw new Error("Runtime not initialized");');
  lines.push('');
  lines.push(`    const fn = this.instance.exports.${name} as Function;`);
  lines.push('');

  // Encode input parameters
  const paramSetup: string[] = [];
  const params: string[] = [];
  
  for (const field of behavior.input.fields) {
    const fname = field.name.name;
    const prep = prepareInputParam(fname, field.type);
    if (prep.setup) {
      paramSetup.push(`    ${prep.setup}`);
    }
    params.push(prep.param);
  }

  if (paramSetup.length > 0) {
    lines.push(paramSetup.join('\n'));
    lines.push('');
  }

  lines.push(`    try {`);
  lines.push(`      const result = fn(${params.join(', ')});`);
  lines.push(`      return { success: true, data: this.decodeResult(result) };`);
  lines.push(`    } catch (error) {`);
  lines.push(`      return { success: false, error: 'EXECUTION_ERROR', message: String(error) };`);
  lines.push(`    }`);
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

function generateEntityMethods(entity: Entity): string {
  const lines: string[] = [];
  const name = entity.name.name;

  lines.push(`  create${name}(data: Partial<${name}>): number {`);
  lines.push('    if (!this.instance) throw new Error("Runtime not initialized");');
  lines.push(`    const create = this.instance.exports.${name}_new as () => number;`);
  lines.push('    const ptr = create();');
  lines.push('');
  
  for (const field of entity.fields) {
    const fname = field.name.name;
    const setter = `${name}_set_${fname}`;
    lines.push(`    if (data.${fname} !== undefined) {`);
    lines.push(`      const set = this.instance.exports.${setter} as (ptr: number, val: any) => void;`);
    lines.push(`      set(ptr, data.${fname});`);
    lines.push('    }');
  }
  
  lines.push('');
  lines.push('    return ptr;');
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

function prepareInputParam(name: string, type: TypeDefinition): { setup?: string; param: string } {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String':
          return {
            setup: `const ${name}Ptr = this.writeString(input.${name});`,
            param: `${name}Ptr`,
          };
        default:
          return { param: `input.${name}` };
      }
    default:
      return { param: `input.${name}` };
  }
}

// ============================================================================
// JAVASCRIPT BINDINGS
// ============================================================================

function generateJavaScriptBindings(
  domain: Domain,
  options: BindingsOptions
): GeneratedBindings {
  const lines: string[] = [];
  const name = domain.name.name;

  lines.push('// ============================================================================');
  lines.push(`// ${name} WebAssembly Bindings`);
  lines.push('// Auto-generated from ISL specification');
  lines.push('// ============================================================================');
  lines.push('');

  if (options.style === 'class') {
    lines.push(`export class ${name}Runtime {`);
    lines.push('  #instance = null;');
    lines.push('  #memory = null;');
    lines.push('  #textEncoder = new TextEncoder();');
    lines.push('  #textDecoder = new TextDecoder();');
    lines.push('');
    lines.push('  async initialize(wasmPath) {');
    lines.push('    const imports = this.#createImports();');
    lines.push('    const response = await fetch(wasmPath);');
    lines.push('    const buffer = await response.arrayBuffer();');
    lines.push('    const { instance } = await WebAssembly.instantiate(buffer, imports);');
    lines.push('    this.#instance = instance;');
    lines.push('    this.#memory = instance.exports.memory;');
    lines.push('  }');
    lines.push('');
    lines.push('  #createImports() {');
    lines.push('    return {');
    lines.push('      env: {');
    lines.push('        log: (ptr, len) => console.log(this.#readString(ptr, len)),');
    lines.push('        now: () => BigInt(Date.now()),');
    lines.push('        random: () => Math.random(),');
    lines.push('      },');
    lines.push('      storage: {');
    lines.push('        get: () => 0,');
    lines.push('        set: () => 1,');
    lines.push('        delete: () => 1,');
    lines.push('      },');
    lines.push('    };');
    lines.push('  }');
    lines.push('');

    // Generate methods
    for (const behavior of domain.behaviors) {
      const behaviorName = behavior.name.name;
      lines.push(`  ${behaviorName.toLowerCase()}(input) {`);
      lines.push(`    const fn = this.#instance.exports.${behaviorName};`);
      lines.push('    return fn(input);');
      lines.push('  }');
      lines.push('');
    }

    lines.push('  #readString(ptr, len) {');
    lines.push('    const bytes = new Uint8Array(this.#memory.buffer, ptr, len);');
    lines.push('    return this.#textDecoder.decode(bytes);');
    lines.push('  }');
    lines.push('}');
  } else {
    lines.push('let instance = null;');
    lines.push('let memory = null;');
    lines.push('');
    lines.push('export async function initialize(wasmPath) {');
    lines.push('  const response = await fetch(wasmPath);');
    lines.push('  const buffer = await response.arrayBuffer();');
    lines.push('  const result = await WebAssembly.instantiate(buffer, createImports());');
    lines.push('  instance = result.instance;');
    lines.push('  memory = instance.exports.memory;');
    lines.push('}');
    lines.push('');

    for (const behavior of domain.behaviors) {
      const behaviorName = behavior.name.name;
      lines.push(`export function ${behaviorName.toLowerCase()}(input) {`);
      lines.push(`  return instance.exports.${behaviorName}(input);`);
      lines.push('}');
      lines.push('');
    }
  }

  return { code: lines.join('\n') };
}

// ============================================================================
// RUNTIME FUNCTIONS (functional style)
// ============================================================================

function generateRuntimeFunctions(domain: Domain, _options: BindingsOptions): string {
  const lines: string[] = [];
  
  lines.push('let wasmInstance: WebAssembly.Instance | null = null;');
  lines.push('let wasmMemory: WebAssembly.Memory | null = null;');
  lines.push('');
  lines.push('export async function initialize(wasmPath: string | BufferSource): Promise<void> {');
  lines.push('  // Implementation similar to class version');
  lines.push('}');
  lines.push('');

  for (const behavior of domain.behaviors) {
    const name = behavior.name.name;
    const camelName = name.charAt(0).toLowerCase() + name.slice(1);
    lines.push(`export function ${camelName}(input: ${name}Input): ${name}Result {`);
    lines.push('  if (!wasmInstance) throw new Error("Not initialized");');
    lines.push(`  const fn = wasmInstance.exports.${name} as Function;`);
    lines.push('  return { success: true, data: fn(input) };');
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function generateHelperFunctions(): string {
  return `
// Helper: Load WASM from URL
export async function loadWasm(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`Failed to load WASM: \${response.status}\`);
  return response.arrayBuffer();
}

// Helper: Create shared memory
export function createSharedMemory(initialPages: number, maxPages: number): WebAssembly.Memory {
  return new WebAssembly.Memory({ initial: initialPages, maximum: maxPages, shared: true });
}

// Helper: Encode UTF-8 string to memory
export function encodeString(memory: WebAssembly.Memory, str: string, offset: number): number {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  new Uint8Array(memory.buffer, offset).set(bytes);
  return bytes.length;
}

// Helper: Decode UTF-8 string from memory
export function decodeString(memory: WebAssembly.Memory, ptr: number, len: number): string {
  const decoder = new TextDecoder();
  const bytes = new Uint8Array(memory.buffer, ptr, len);
  return decoder.decode(bytes);
}
`;
}

function islTypeToTS(type: TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      switch (type.name) {
        case 'String': return 'string';
        case 'Int': return 'number';
        case 'Decimal': return 'number';
        case 'Boolean': return 'boolean';
        case 'Timestamp': return 'Date';
        case 'UUID': return 'string';
        case 'Duration': return 'number';
        default: return 'unknown';
      }
    case 'ReferenceType':
      return type.name.parts.map((p: Identifier) => p.name).join('.');
    case 'ListType':
      return `${islTypeToTS(type.element)}[]`;
    case 'MapType':
      return `Map<${islTypeToTS(type.key)}, ${islTypeToTS(type.value)}>`;
    case 'OptionalType':
      return `${islTypeToTS(type.inner)} | null`;
    case 'EnumType':
      return type.variants.map((v: Identifier) => `'${v.name}'`).join(' | ');
    default:
      return 'unknown';
  }
}
