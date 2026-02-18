// ============================================================================
// Input Validation Detectors - Library-specific validation detection
// ============================================================================

import type {
  ValidationLibrary,
  ValidationSchema,
  ValidationField,
  FieldConstraints,
} from './types.js';

/**
 * Detect Zod validation
 * Looks for: .parse(), .safeParse(), z.object({...})
 */
export function detectZodValidation(code: string, startLine: number): ValidationSchema | null {
  // Check for Zod parse calls
  const parseMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\.(?:parse|safeParse)\s*\(/);
  if (!parseMatch) {
    return null;
  }

  const schemaName = parseMatch[2];
  const resultVar = parseMatch[1];

  // Find the schema definition
  const schemaRegex = new RegExp(`(?:const|let|var)\\s+${schemaName}\\s*=\\s*z\\.object\\s*\\(\\s*\\{([^}]+)\\}`, 's');
  const schemaMatch = code.match(schemaRegex);

  if (!schemaMatch) {
    return null;
  }

  const fields = parseZodSchema(schemaMatch[1]!);
  const line = startLine + (code.substring(0, parseMatch.index).split('\n').length - 1);

  // Check if result is used
  const isUsed = code.includes(`${resultVar}.`) || code.includes(`${resultVar}[`);

  return {
    library: 'zod',
    line,
    fields,
    isUsed,
  };
}

function parseZodSchema(schemaContent: string): ValidationField[] {
  const fields: ValidationField[] = [];
  const fieldRegex = /(\w+)\s*:\s*z\.(\w+)\s*\(\s*\)([^,}]*)/g;
  let match;

  while ((match = fieldRegex.exec(schemaContent)) !== null) {
    const [, fieldName, fieldType, chainCalls] = match;
    const constraints = parseZodConstraints(fieldType!, chainCalls!);

    fields.push({
      name: fieldName!,
      type: fieldType!,
      constraints,
    });
  }

  return fields;
}

function parseZodConstraints(type: string, chainCalls: string): FieldConstraints {
  const constraints: FieldConstraints = {
    required: !chainCalls.includes('.optional()'),
  };

  // String constraints
  if (type === 'string') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*(\d+)\s*\)/);
    if (minMatch) constraints.minLength = parseInt(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*(\d+)\s*\)/);
    if (maxMatch) constraints.maxLength = parseInt(maxMatch[1]!);

    const emailMatch = chainCalls.match(/\.email\s*\(\s*\)/);
    if (emailMatch) constraints.format = 'email';

    const urlMatch = chainCalls.match(/\.url\s*\(\s*\)/);
    if (urlMatch) constraints.format = 'url';

    const uuidMatch = chainCalls.match(/\.uuid\s*\(\s*\)/);
    if (uuidMatch) constraints.format = 'uuid';

    const regexMatch = chainCalls.match(/\.regex\s*\(\s*\/(.+?)\/\s*\)/);
    if (regexMatch) constraints.pattern = regexMatch[1]!;
  }

  // Number constraints
  if (type === 'number' || type === 'int') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*([\d.]+)\s*\)/);
    if (minMatch) constraints.min = parseFloat(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*([\d.]+)\s*\)/);
    if (maxMatch) constraints.max = parseFloat(maxMatch[1]!);
  }

  // Enum
  const enumMatch = chainCalls.match(/\.enum\s*\(\s*\[([^\]]+)\]\s*\)/);
  if (enumMatch) {
    constraints.enum = enumMatch[1]!.split(',').map(v => v.trim().replace(/['"]/g, ''));
  }

  return constraints;
}

/**
 * Detect Joi validation
 * Looks for: .validate(), Joi.object({...}).validate()
 */
export function detectJoiValidation(code: string, startLine: number): ValidationSchema | null {
  const validateMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(\w+)\.validate\s*\(/);
  if (!validateMatch) {
    return null;
  }

  const schemaName = validateMatch[2];
  const resultVar = validateMatch[1];

  // Find the schema definition
  const schemaRegex = new RegExp(`(?:const|let|var)\\s+${schemaName}\\s*=\\s*Joi\\.object\\s*\\(\\s*\\{([^}]+)\\}`, 's');
  const schemaMatch = code.match(schemaRegex);

  if (!schemaMatch) {
    return null;
  }

  const fields = parseJoiSchema(schemaMatch[1]!);
  const line = startLine + (code.substring(0, validateMatch.index).split('\n').length - 1);

  const isUsed = code.includes(`${resultVar}.value`) || code.includes(`${resultVar}.error`);

  return {
    library: 'joi',
    line,
    fields,
    isUsed,
  };
}

function parseJoiSchema(schemaContent: string): ValidationField[] {
  const fields: ValidationField[] = [];
  const fieldRegex = /(\w+)\s*:\s*Joi\.(\w+)\s*\(\s*\)([^,}]*)/g;
  let match;

  while ((match = fieldRegex.exec(schemaContent)) !== null) {
    const [, fieldName, fieldType, chainCalls] = match;
    const constraints = parseJoiConstraints(fieldType!, chainCalls!);

    fields.push({
      name: fieldName!,
      type: fieldType!,
      constraints,
    });
  }

  return fields;
}

function parseJoiConstraints(type: string, chainCalls: string): FieldConstraints {
  const constraints: FieldConstraints = {
    required: chainCalls.includes('.required()'),
  };

  if (type === 'string') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*(\d+)\s*\)/);
    if (minMatch) constraints.minLength = parseInt(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*(\d+)\s*\)/);
    if (maxMatch) constraints.maxLength = parseInt(maxMatch[1]!);

    const emailMatch = chainCalls.match(/\.email\s*\(\s*\)/);
    if (emailMatch) constraints.format = 'email';

    const uriMatch = chainCalls.match(/\.uri\s*\(\s*\)/);
    if (uriMatch) constraints.format = 'url';

    const patternMatch = chainCalls.match(/\.pattern\s*\(\s*\/(.+?)\/\s*\)/);
    if (patternMatch) constraints.pattern = patternMatch[1]!;
  }

  if (type === 'number') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*([\d.]+)\s*\)/);
    if (minMatch) constraints.min = parseFloat(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*([\d.]+)\s*\)/);
    if (maxMatch) constraints.max = parseFloat(maxMatch[1]!);
  }

  const validMatch = chainCalls.match(/\.valid\s*\(\s*([^\)]+)\s*\)/);
  if (validMatch) {
    constraints.enum = validMatch[1]!.split(',').map(v => v.trim().replace(/['"]/g, ''));
  }

  return constraints;
}

/**
 * Detect Yup validation
 * Looks for: .validate(), .validateSync()
 */
export function detectYupValidation(code: string, startLine: number): ValidationSchema | null {
  const validateMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(\w+)\.validate(?:Sync)?\s*\(/);
  if (!validateMatch) {
    return null;
  }

  const schemaName = validateMatch[2];
  const resultVar = validateMatch[1];

  // Find the schema definition
  const schemaRegex = new RegExp(`(?:const|let|var)\\s+${schemaName}\\s*=\\s*yup\\.object\\s*\\(\\s*\\{([^}]+)\\}`, 's');
  const schemaMatch = code.match(schemaRegex);

  if (!schemaMatch) {
    return null;
  }

  const fields = parseYupSchema(schemaMatch[1]!);
  const line = startLine + (code.substring(0, validateMatch.index).split('\n').length - 1);

  const isUsed = code.includes(`${resultVar}.`);

  return {
    library: 'yup',
    line,
    fields,
    isUsed,
  };
}

function parseYupSchema(schemaContent: string): ValidationField[] {
  const fields: ValidationField[] = [];
  const fieldRegex = /(\w+)\s*:\s*yup\.(\w+)\s*\(\s*\)([^,}]*)/g;
  let match;

  while ((match = fieldRegex.exec(schemaContent)) !== null) {
    const [, fieldName, fieldType, chainCalls] = match;
    const constraints = parseYupConstraints(fieldType!, chainCalls!);

    fields.push({
      name: fieldName!,
      type: fieldType!,
      constraints,
    });
  }

  return fields;
}

function parseYupConstraints(type: string, chainCalls: string): FieldConstraints {
  const constraints: FieldConstraints = {
    required: chainCalls.includes('.required()'),
  };

  if (type === 'string') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*(\d+)\s*\)/);
    if (minMatch) constraints.minLength = parseInt(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*(\d+)\s*\)/);
    if (maxMatch) constraints.maxLength = parseInt(maxMatch[1]!);

    const emailMatch = chainCalls.match(/\.email\s*\(\s*\)/);
    if (emailMatch) constraints.format = 'email';

    const urlMatch = chainCalls.match(/\.url\s*\(\s*\)/);
    if (urlMatch) constraints.format = 'url';

    const matchesMatch = chainCalls.match(/\.matches\s*\(\s*\/(.+?)\/\s*\)/);
    if (matchesMatch) constraints.pattern = matchesMatch[1]!;
  }

  if (type === 'number') {
    const minMatch = chainCalls.match(/\.min\s*\(\s*([\d.]+)\s*\)/);
    if (minMatch) constraints.min = parseFloat(minMatch[1]!);

    const maxMatch = chainCalls.match(/\.max\s*\(\s*([\d.]+)\s*\)/);
    if (maxMatch) constraints.max = parseFloat(maxMatch[1]!);
  }

  const oneOfMatch = chainCalls.match(/\.oneOf\s*\(\s*\[([^\]]+)\]\s*\)/);
  if (oneOfMatch) {
    constraints.enum = oneOfMatch[1]!.split(',').map(v => v.trim().replace(/['"]/g, ''));
  }

  return constraints;
}

/**
 * Detect class-validator decorators
 * Looks for: @IsEmail(), @IsNotEmpty(), etc. + validate() call
 */
export function detectClassValidatorValidation(code: string, startLine: number): ValidationSchema | null {
  // Check for validate() call
  const validateMatch = code.match(/(?:await\s+)?validate\s*\(/);
  if (!validateMatch) {
    return null;
  }

  // Look for decorator-based class
  const classMatch = code.match(/class\s+(\w+)\s*\{([^}]+)\}/s);
  if (!classMatch) {
    return null;
  }

  const fields = parseClassValidatorFields(classMatch[2]!);
  const line = startLine + (code.substring(0, validateMatch.index).split('\n').length - 1);

  return {
    library: 'class-validator',
    line,
    fields,
    isUsed: true, // validate() returns errors
  };
}

function parseClassValidatorFields(classBody: string): ValidationField[] {
  const fields: ValidationField[] = [];
  const fieldRegex = /(@[\w\s(),]+)\s+(\w+)\s*[!:]/g;
  let match;

  while ((match = fieldRegex.exec(classBody)) !== null) {
    const [, decorators, fieldName] = match;
    const constraints = parseClassValidatorDecorators(decorators!);

    fields.push({
      name: fieldName!,
      type: null,
      constraints,
    });
  }

  return fields;
}

function parseClassValidatorDecorators(decorators: string): FieldConstraints {
  const constraints: FieldConstraints = {
    required: !decorators.includes('@IsOptional'),
  };

  if (decorators.includes('@IsNotEmpty')) {
    constraints.required = true;
  }

  if (decorators.includes('@IsEmail')) {
    constraints.format = 'email';
  }

  if (decorators.includes('@IsUrl')) {
    constraints.format = 'url';
  }

  if (decorators.includes('@IsUUID')) {
    constraints.format = 'uuid';
  }

  const minLengthMatch = decorators.match(/@MinLength\s*\(\s*(\d+)\s*\)/);
  if (minLengthMatch) {
    constraints.minLength = parseInt(minLengthMatch[1]!);
  }

  const maxLengthMatch = decorators.match(/@MaxLength\s*\(\s*(\d+)\s*\)/);
  if (maxLengthMatch) {
    constraints.maxLength = parseInt(maxLengthMatch[1]!);
  }

  const minMatch = decorators.match(/@Min\s*\(\s*([\d.]+)\s*\)/);
  if (minMatch) {
    constraints.min = parseFloat(minMatch[1]!);
  }

  const maxMatch = decorators.match(/@Max\s*\(\s*([\d.]+)\s*\)/);
  if (maxMatch) {
    constraints.max = parseFloat(maxMatch[1]!);
  }

  const matchesMatch = decorators.match(/@Matches\s*\(\s*\/(.+?)\/\s*\)/);
  if (matchesMatch) {
    constraints.pattern = matchesMatch[1]!;
  }

  return constraints;
}

/**
 * Detect manual validation (TypeScript type narrowing)
 * Looks for: typeof checks, instanceof, in operator, explicit if guards
 */
export function detectManualValidation(code: string, startLine: number): ValidationSchema | null {
  const manualChecks: RegExp[] = [
    /typeof\s+\w+\.\w+\s*[!=]==?\s*['"]string['"]/,
    /typeof\s+\w+\.\w+\s*[!=]==?\s*['"]number['"]/,
    /typeof\s+\w+\.\w+\s*[!=]==?\s*['"]boolean['"]/,
    /instanceof\s+\w+/,
    /['"](\w+)['"]\s+in\s+\w+/,
    /\w+\.\w+\s*[!=]==?\s*(?:undefined|null)/,
    /if\s*\(\s*!\w+\.\w+\s*\)/,
  ];

  const hasManualCheck = manualChecks.some(regex => regex.test(code));
  if (!hasManualCheck) {
    return null;
  }

  // Extract field names from checks
  const fields: ValidationField[] = [];
  const fieldRegex = /(?:typeof|instanceof|in)\s+(?:\w+\.)?(\w+)/g;
  let match;
  const seenFields = new Set<string>();

  while ((match = fieldRegex.exec(code)) !== null) {
    const fieldName = match[1];
    if (fieldName && !seenFields.has(fieldName)) {
      seenFields.add(fieldName);
      fields.push({
        name: fieldName,
        type: null,
        constraints: { required: true },
      });
    }
  }

  if (fields.length === 0) {
    return null;
  }

  const line = startLine;

  return {
    library: 'manual',
    line,
    fields,
    isUsed: true,
  };
}

/**
 * Detect Fastify JSON Schema validation
 * Looks for: schema: { body: {...} } in route options
 */
export function detectFastifyValidation(code: string, startLine: number): ValidationSchema | null {
  const schemaMatch = code.match(/schema\s*:\s*\{\s*body\s*:\s*\{([^}]+)\}/s);
  if (!schemaMatch) {
    return null;
  }

  const fields = parseFastifySchema(schemaMatch[1]!);
  const line = startLine + (code.substring(0, schemaMatch.index).split('\n').length - 1);

  return {
    library: 'fastify-schema',
    line,
    fields,
    isUsed: true, // Fastify validates automatically
  };
}

function parseFastifySchema(schemaContent: string): ValidationField[] {
  const fields: ValidationField[] = [];
  const propertiesMatch = schemaContent.match(/properties\s*:\s*\{([^}]+)\}/s);
  
  if (!propertiesMatch) {
    return fields;
  }

  const fieldRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let match;

  while ((match = fieldRegex.exec(propertiesMatch[1]!)) !== null) {
    const [, fieldName, fieldDef] = match;
    const constraints = parseFastifyConstraints(fieldDef!);

    fields.push({
      name: fieldName!,
      type: null,
      constraints,
    });
  }

  return fields;
}

function parseFastifyConstraints(fieldDef: string): FieldConstraints {
  const constraints: FieldConstraints = {
    required: false, // Determined by 'required' array
  };

  const typeMatch = fieldDef.match(/type\s*:\s*['"](\w+)['"]/);
  const minLengthMatch = fieldDef.match(/minLength\s*:\s*(\d+)/);
  const maxLengthMatch = fieldDef.match(/maxLength\s*:\s*(\d+)/);
  const minimumMatch = fieldDef.match(/minimum\s*:\s*([\d.]+)/);
  const maximumMatch = fieldDef.match(/maximum\s*:\s*([\d.]+)/);
  const patternMatch = fieldDef.match(/pattern\s*:\s*['"](.+?)['"]/);
  const formatMatch = fieldDef.match(/format\s*:\s*['"](\w+)['"]/);
  const enumMatch = fieldDef.match(/enum\s*:\s*\[([^\]]+)\]/);

  if (minLengthMatch) constraints.minLength = parseInt(minLengthMatch[1]!);
  if (maxLengthMatch) constraints.maxLength = parseInt(maxLengthMatch[1]!);
  if (minimumMatch) constraints.min = parseFloat(minimumMatch[1]!);
  if (maximumMatch) constraints.max = parseFloat(maximumMatch[1]!);
  if (patternMatch) constraints.pattern = patternMatch[1]!;
  if (formatMatch) constraints.format = formatMatch[1]!;
  if (enumMatch) {
    constraints.enum = enumMatch[1]!.split(',').map(v => v.trim().replace(/['"]/g, ''));
  }

  return constraints;
}

/**
 * Detect all validation types in code
 */
export function detectValidation(code: string, startLine: number): ValidationSchema | null {
  return (
    detectZodValidation(code, startLine) ||
    detectJoiValidation(code, startLine) ||
    detectYupValidation(code, startLine) ||
    detectClassValidatorValidation(code, startLine) ||
    detectFastifyValidation(code, startLine) ||
    detectManualValidation(code, startLine)
  );
}
