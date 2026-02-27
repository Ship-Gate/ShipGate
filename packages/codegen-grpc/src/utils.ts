// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert string to SCREAMING_SNAKE_CASE (for proto enum values)
 */
export function toScreamingSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

/**
 * Convert string to snake_case (for proto field names)
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert string to PascalCase (for proto message names)
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

/**
 * Convert string to camelCase (for JSON field names)
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert ISL type name to proto-friendly case
 */
export function toProtoCase(str: string): string {
  return toPascalCase(str);
}

/**
 * Generate a proto package name from domain name and version
 */
export function toProtoPackage(domain: string, version?: string): string {
  const parts = domain.toLowerCase().split(/[.\s]+/);
  if (version) {
    const v = version.replace(/\./g, '_').replace(/^v?/, 'v');
    parts.push(v);
  }
  return parts.join('.');
}

/**
 * Escape string for proto string literal
 */
export function escapeProtoString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape regex for proto-validate pattern
 */
export function escapeRegexForProto(pattern: string): string {
  // Remove leading/trailing slashes if present
  let p = pattern;
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/')) p = p.slice(0, -1);
  
  // Escape backslashes for proto string
  return p.replace(/\\/g, '\\\\');
}

/**
 * Indent text by specified number of spaces
 */
export function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => (line.trim() ? pad + line : line))
    .join('\n');
}

/**
 * Generate unique field number (starting from 1)
 */
export function* fieldNumbers(start = 1): Generator<number> {
  let n = start;
  while (true) {
    // Skip reserved field numbers (19000-19999 for protobuf internal use)
    if (n >= 19000 && n <= 19999) {
      n = 20000;
    }
    yield n++;
  }
}

/**
 * Join proto lines with proper line breaks
 */
export function joinProtoLines(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join('\n');
}

/**
 * Wrap text in proto comment
 */
export function protoComment(text: string, style: 'line' | 'block' = 'line'): string {
  if (style === 'block') {
    const lines = text.split('\n');
    return `/*\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
  }
  return text
    .split('\n')
    .map(line => `// ${line}`)
    .join('\n');
}

/**
 * Create proto file header
 */
export function protoFileHeader(options: {
  syntax?: string;
  package: string;
  goPackage?: string;
  imports?: string[];
}): string {
  const lines: string[] = [
    `syntax = "${options.syntax ?? 'proto3'}";`,
    '',
    `package ${options.package};`,
  ];
  
  if (options.goPackage) {
    lines.push('');
    lines.push(`option go_package = "${options.goPackage}";`);
  }
  
  if (options.imports && options.imports.length > 0) {
    lines.push('');
    for (const imp of options.imports) {
      lines.push(`import "${imp}";`);
    }
  }
  
  return lines.join('\n');
}
