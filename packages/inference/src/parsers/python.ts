/**
 * Python Parser
 *
 * Parse Python source files to extract type and function information.
 * Uses regex-based parsing for simplicity (no Python AST dependency).
 */

import * as fs from 'fs';

export interface PythonParseResult {
  language: 'python';
  classes: ParsedPythonClass[];
  functions: ParsedPythonFunction[];
  dataclasses: ParsedDataclass[];
  enums: ParsedPythonEnum[];
  typeAliases: ParsedPythonTypeAlias[];
}

export interface ParsedPythonClass {
  name: string;
  attributes: ParsedPythonAttribute[];
  methods: ParsedPythonFunction[];
  bases: string[];
  decorators: string[];
  location: ParsedPythonLocation;
}

export interface ParsedDataclass {
  name: string;
  fields: ParsedDataclassField[];
  frozen: boolean;
  location: ParsedPythonLocation;
}

export interface ParsedDataclassField {
  name: string;
  type: string;
  default?: string;
  optional: boolean;
}

export interface ParsedPythonFunction {
  name: string;
  async: boolean;
  parameters: ParsedPythonParameter[];
  returnType?: string;
  decorators: string[];
  docstring?: string;
  body: string;
  location: ParsedPythonLocation;
}

export interface ParsedPythonParameter {
  name: string;
  type?: string;
  default?: string;
  optional: boolean;
}

export interface ParsedPythonAttribute {
  name: string;
  type?: string;
  value?: string;
}

export interface ParsedPythonEnum {
  name: string;
  members: string[];
  location: ParsedPythonLocation;
}

export interface ParsedPythonTypeAlias {
  name: string;
  type: string;
  location: ParsedPythonLocation;
}

export interface ParsedPythonLocation {
  file: string;
  line: number;
}

/**
 * Parse Python source files
 */
export async function parsePython(files: string[]): Promise<PythonParseResult> {
  const result: PythonParseResult = {
    language: 'python',
    classes: [],
    functions: [],
    dataclasses: [],
    enums: [],
    typeAliases: [],
  };

  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf-8');
    const lines = content.split('\n');

    // Parse dataclasses
    const dataclassMatches = content.matchAll(
      /@dataclass(?:\(frozen=(\w+)\))?\s*\nclass\s+(\w+)(?:\(([^)]*)\))?:\s*\n((?:\s+.+\n)*)/g
    );
    for (const match of dataclassMatches) {
      const frozen = match[1] === 'True';
      const name = match[2];
      const body = match[4];
      const fields = parseDataclassFields(body);
      const lineNum = getLineNumber(content, match.index ?? 0);

      result.dataclasses.push({
        name,
        fields,
        frozen,
        location: { file, line: lineNum },
      });
    }

    // Parse regular classes
    const classMatches = content.matchAll(
      /(?:^|\n)((?:@\w+(?:\([^)]*\))?\s*\n)*)class\s+(\w+)(?:\(([^)]*)\))?:\s*\n((?:\s+.+\n)*)/gm
    );
    for (const match of classMatches) {
      const decorators = match[1]
        ? match[1].match(/@(\w+)/g)?.map((d) => d.slice(1)) ?? []
        : [];

      // Skip if it's a dataclass (already parsed)
      if (decorators.includes('dataclass')) continue;

      const name = match[2];
      const bases = match[3]?.split(',').map((b) => b.trim()).filter(Boolean) ?? [];
      const body = match[4];
      const lineNum = getLineNumber(content, match.index ?? 0);

      // Check if it's an Enum
      if (bases.includes('Enum') || bases.includes('StrEnum') || bases.includes('IntEnum')) {
        const members = parseEnumMembers(body);
        result.enums.push({
          name,
          members,
          location: { file, line: lineNum },
        });
        continue;
      }

      const attributes = parseClassAttributes(body);
      const methods = parseClassMethods(body, file, lineNum);

      result.classes.push({
        name,
        attributes,
        methods,
        bases,
        decorators,
        location: { file, line: lineNum },
      });
    }

    // Parse standalone functions
    const functionMatches = content.matchAll(
      /(?:^|\n)((?:@\w+(?:\([^)]*\))?\s*\n)*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:\s*\n((?:\s+.+\n)*)/gm
    );
    for (const match of functionMatches) {
      const decorators = match[1]
        ? match[1].match(/@(\w+)/g)?.map((d) => d.slice(1)) ?? []
        : [];
      const async = !!match[2];
      const name = match[3];
      const paramsStr = match[4];
      const returnType = match[5]?.trim();
      const body = match[6];
      const lineNum = getLineNumber(content, match.index ?? 0);

      // Skip class methods (they'll be parsed with their class)
      if (body.match(/^\s{4}/m) === null) continue;

      const parameters = parseParameters(paramsStr);
      const docstring = extractDocstring(body);

      result.functions.push({
        name,
        async,
        parameters,
        returnType,
        decorators,
        docstring,
        body,
        location: { file, line: lineNum },
      });
    }

    // Parse type aliases
    const typeAliasMatches = content.matchAll(/^(\w+)\s*=\s*(TypeVar|Union|Optional|Literal)\[([^\]]+)\]/gm);
    for (const match of typeAliasMatches) {
      const name = match[1];
      const type = `${match[2]}[${match[3]}]`;
      const lineNum = getLineNumber(content, match.index ?? 0);

      result.typeAliases.push({
        name,
        type,
        location: { file, line: lineNum },
      });
    }
  }

  return result;
}

function parseDataclassFields(body: string): ParsedDataclassField[] {
  const fields: ParsedDataclassField[] = [];
  const fieldMatches = body.matchAll(/\s+(\w+):\s*([^=\n]+)(?:\s*=\s*(.+))?/g);

  for (const match of fieldMatches) {
    const name = match[1];
    let type = match[2].trim();
    const defaultValue = match[3]?.trim();
    const optional = type.includes('Optional') || defaultValue === 'None';

    // Clean up Optional type
    if (type.startsWith('Optional[')) {
      type = type.slice(9, -1);
    }

    fields.push({
      name,
      type,
      default: defaultValue,
      optional,
    });
  }

  return fields;
}

function parseEnumMembers(body: string): string[] {
  const members: string[] = [];
  const memberMatches = body.matchAll(/\s+(\w+)\s*=/g);

  for (const match of memberMatches) {
    members.push(match[1]);
  }

  return members;
}

function parseClassAttributes(body: string): ParsedPythonAttribute[] {
  const attributes: ParsedPythonAttribute[] = [];

  // Look for __init__ assignments
  const initMatch = body.match(/def\s+__init__\s*\([^)]*\):[^]*?(?=\n\s+def|\n(?!\s))/);
  if (initMatch) {
    const initBody = initMatch[0];
    const assignMatches = initBody.matchAll(/self\.(\w+)\s*(?::\s*([^=]+))?\s*=\s*(.+)/g);
    for (const match of assignMatches) {
      attributes.push({
        name: match[1],
        type: match[2]?.trim(),
        value: match[3]?.trim(),
      });
    }
  }

  // Look for class-level type annotations
  const annotationMatches = body.matchAll(/^\s{4}(\w+):\s*([^=\n]+)/gm);
  for (const match of annotationMatches) {
    if (!attributes.some((a) => a.name === match[1])) {
      attributes.push({
        name: match[1],
        type: match[2].trim(),
      });
    }
  }

  return attributes;
}

function parseClassMethods(body: string, file: string, baseLineNum: number): ParsedPythonFunction[] {
  const methods: ParsedPythonFunction[] = [];
  const methodMatches = body.matchAll(
    /((?:@\w+(?:\([^)]*\))?\s*\n)*)\s+(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:\s*\n((?:\s+.+\n)*)/g
  );

  for (const match of methodMatches) {
    const decorators = match[1]
      ? match[1].match(/@(\w+)/g)?.map((d) => d.slice(1)) ?? []
      : [];
    const async = !!match[2];
    const name = match[3];
    const paramsStr = match[4];
    const returnType = match[5]?.trim();
    const methodBody = match[6];

    // Skip self parameter
    const parameters = parseParameters(paramsStr).filter((p) => p.name !== 'self' && p.name !== 'cls');
    const docstring = extractDocstring(methodBody);

    methods.push({
      name,
      async,
      parameters,
      returnType,
      decorators,
      docstring,
      body: methodBody,
      location: { file, line: baseLineNum + getLineNumber(body, match.index ?? 0) },
    });
  }

  return methods;
}

function parseParameters(paramsStr: string): ParsedPythonParameter[] {
  const params: ParsedPythonParameter[] = [];
  if (!paramsStr.trim()) return params;

  // Simple split by comma (doesn't handle nested types well, but works for most cases)
  const paramParts = paramsStr.split(',');

  for (const part of paramParts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;

    // Match: name: type = default or name = default or name: type or name
    const match = trimmed.match(/(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?/);
    if (match) {
      const name = match[1];
      const type = match[2]?.trim();
      const defaultValue = match[3]?.trim();
      const optional = type?.includes('Optional') || defaultValue !== undefined;

      params.push({
        name,
        type,
        default: defaultValue,
        optional,
      });
    }
  }

  return params;
}

function extractDocstring(body: string): string | undefined {
  const match = body.match(/^\s+"""([^]*?)"""/);
  if (match) {
    return match[1].trim();
  }
  return undefined;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

/**
 * Extract validation patterns from Python function body
 */
export function extractValidationsFromPython(body: string): PythonValidationPattern[] {
  const validations: PythonValidationPattern[] = [];

  // Look for if statements with raise
  const ifRaiseMatches = body.matchAll(/if\s+([^:]+):\s*\n\s+raise\s+(\w+)\(["']([^"']+)["']\)/g);
  for (const match of ifRaiseMatches) {
    validations.push({
      condition: match[1].trim(),
      negated: true,
      errorType: match[2],
      errorMessage: match[3],
    });
  }

  // Look for assert statements
  const assertMatches = body.matchAll(/assert\s+([^,\n]+)(?:,\s*["']([^"']+)["'])?/g);
  for (const match of assertMatches) {
    validations.push({
      condition: match[1].trim(),
      negated: false,
      errorMessage: match[2],
    });
  }

  return validations;
}

export interface PythonValidationPattern {
  condition: string;
  negated: boolean;
  errorType?: string;
  errorMessage?: string;
}
