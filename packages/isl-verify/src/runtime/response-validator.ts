/**
 * Response Validator
 * 
 * Validates HTTP response bodies against TypeScript type shapes
 */

import type { TypeShape } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ResponseValidator {
  validateResponse(response: unknown, expectedShape: TypeShape): ValidationResult {
    const errors: string[] = [];
    this.validateValue(response, expectedShape, 'response', errors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateValue(
    value: unknown,
    shape: TypeShape,
    path: string,
    errors: string[]
  ): void {
    // Type check
    const actualType = this.getActualType(value);
    
    if (actualType !== shape.type) {
      // Allow null for optional fields
      if (value === null && !shape.required) {
        return;
      }
      errors.push(`${path}: expected ${shape.type}, got ${actualType}`);
      return;
    }

    // Shape-specific validation
    switch (shape.type) {
      case 'object':
        this.validateObject(value as Record<string, unknown>, shape, path, errors);
        break;
      
      case 'array':
        this.validateArray(value as unknown[], shape, path, errors);
        break;
      
      case 'string':
        this.validateString(value as string, shape, path, errors);
        break;
      
      case 'number':
        this.validateNumber(value as number, shape, path, errors);
        break;
    }
  }

  private validateObject(
    obj: Record<string, unknown>,
    shape: TypeShape,
    path: string,
    errors: string[]
  ): void {
    // Check required fields
    if (shape.required) {
      for (const field of shape.required) {
        if (!(field in obj)) {
          errors.push(`${path}.${field}: required field missing`);
        }
      }
    }

    // Validate properties
    if (shape.properties) {
      for (const [key, propShape] of Object.entries(shape.properties)) {
        if (key in obj) {
          this.validateValue(obj[key], propShape, `${path}.${key}`, errors);
        }
      }

      // Check for extra fields (potential data leaks)
      const allowedKeys = new Set(Object.keys(shape.properties));
      for (const key of Object.keys(obj)) {
        if (!allowedKeys.has(key)) {
          errors.push(`${path}.${key}: unexpected field (potential data leak)`);
        }
      }
    }
  }

  private validateArray(
    arr: unknown[],
    shape: TypeShape,
    path: string,
    errors: string[]
  ): void {
    if (shape.items) {
      for (let i = 0; i < Math.min(arr.length, 10); i++) {
        this.validateValue(arr[i], shape.items, `${path}[${i}]`, errors);
      }
    }
  }

  private validateString(
    str: string,
    shape: TypeShape,
    path: string,
    errors: string[]
  ): void {
    if (shape.minLength !== undefined && str.length < shape.minLength) {
      errors.push(`${path}: string too short (min ${shape.minLength}, got ${str.length})`);
    }
    
    if (shape.maxLength !== undefined && str.length > shape.maxLength) {
      errors.push(`${path}: string too long (max ${shape.maxLength}, got ${str.length})`);
    }
    
    if (shape.pattern) {
      const regex = new RegExp(shape.pattern);
      if (!regex.test(str)) {
        errors.push(`${path}: string does not match pattern ${shape.pattern}`);
      }
    }
    
    if (shape.enum && !shape.enum.includes(str)) {
      errors.push(`${path}: value not in enum ${JSON.stringify(shape.enum)}`);
    }
  }

  private validateNumber(
    num: number,
    shape: TypeShape,
    path: string,
    errors: string[]
  ): void {
    if (shape.min !== undefined && num < shape.min) {
      errors.push(`${path}: number too small (min ${shape.min}, got ${num})`);
    }
    
    if (shape.max !== undefined && num > shape.max) {
      errors.push(`${path}: number too large (max ${shape.max}, got ${num})`);
    }
  }

  private getActualType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Check for common security issues in response
   */
  checkForLeakedData(response: unknown): string[] {
    const issues: string[] = [];
    const dangerous = ['password', 'passwordHash', 'secret', 'apiKey', 'token', 'privateKey'];
    
    this.scanObject(response, dangerous, '', issues);
    
    return issues;
  }

  private scanObject(
    obj: unknown,
    dangerousKeys: string[],
    path: string,
    issues: string[]
  ): void {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        this.scanObject(obj[i], dangerousKeys, `${path}[${i}]`, issues);
      }
      return;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      const currentPath = path ? `${path}.${key}` : key;
      
      if (dangerousKeys.some(d => keyLower.includes(d.toLowerCase()))) {
        issues.push(`Potential data leak: ${currentPath}`);
      }
      
      this.scanObject(value, dangerousKeys, currentPath, issues);
    }
  }
}
