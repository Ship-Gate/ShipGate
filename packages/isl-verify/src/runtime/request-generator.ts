/**
 * Test Request Generator
 * 
 * Generates test requests from ISL endpoint specs
 */

import type { Domain, ApiBlock, EndpointDecl } from '@isl-lang/parser';
import type { EndpointSpec, TypeShape, RuntimeEvidence } from './types';

export interface GeneratedRequest {
  testCase: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  expectedStatus: number;
  description: string;
}

export class RequestGenerator {
  generateTestRequests(spec: EndpointSpec, authToken?: string, adminToken?: string): GeneratedRequest[] {
    const requests: GeneratedRequest[] = [];

    // 1. Valid request
    requests.push({
      testCase: 'valid_request',
      method: spec.method,
      path: this.fillPathParams(spec.path, spec.params),
      headers: this.buildHeaders(spec.auth, authToken, adminToken),
      body: spec.requestBody ? this.generateValidBody(spec.requestBody) : undefined,
      query: spec.query ? this.generateValidQuery(spec.query) : undefined,
      expectedStatus: 200,
      description: 'Valid request with correct auth and body',
    });

    // 2. Missing auth (if auth required)
    if (spec.auth === 'required' || spec.auth === 'admin') {
      requests.push({
        testCase: 'missing_auth',
        method: spec.method,
        path: this.fillPathParams(spec.path, spec.params),
        headers: {},
        body: spec.requestBody ? this.generateValidBody(spec.requestBody) : undefined,
        expectedStatus: 401,
        description: 'Request without auth token should be rejected',
      });
    }

    // 3. Invalid auth token
    if (spec.auth === 'required' || spec.auth === 'admin') {
      requests.push({
        testCase: 'invalid_auth',
        method: spec.method,
        path: this.fillPathParams(spec.path, spec.params),
        headers: { Authorization: 'Bearer invalid_token_xyz' },
        body: spec.requestBody ? this.generateValidBody(spec.requestBody) : undefined,
        expectedStatus: 401,
        description: 'Request with invalid token should be rejected',
      });
    }

    // 4. Non-admin accessing admin endpoint
    if (spec.auth === 'admin' && authToken && authToken !== adminToken) {
      requests.push({
        testCase: 'non_admin_forbidden',
        method: spec.method,
        path: this.fillPathParams(spec.path, spec.params),
        headers: { Authorization: `Bearer ${authToken}` },
        body: spec.requestBody ? this.generateValidBody(spec.requestBody) : undefined,
        expectedStatus: 403,
        description: 'Non-admin user accessing admin endpoint should be forbidden',
      });
    }

    // 5. Invalid body shape (if POST/PUT/PATCH)
    if (spec.requestBody && ['POST', 'PUT', 'PATCH'].includes(spec.method)) {
      requests.push({
        testCase: 'invalid_body_shape',
        method: spec.method,
        path: this.fillPathParams(spec.path, spec.params),
        headers: this.buildHeaders(spec.auth, authToken, adminToken),
        body: { completely_wrong: 'structure' },
        expectedStatus: 400,
        description: 'Request with wrong body shape should be rejected',
      });
    }

    // 6. Missing required fields
    if (spec.requestBody?.required && spec.requestBody.required.length > 0) {
      for (const field of spec.requestBody.required) {
        const bodyWithoutField = this.generateValidBody(spec.requestBody);
        if (bodyWithoutField && typeof bodyWithoutField === 'object') {
          delete (bodyWithoutField as Record<string, unknown>)[field];
          
          requests.push({
            testCase: `missing_required_field_${field}`,
            method: spec.method,
            path: this.fillPathParams(spec.path, spec.params),
            headers: this.buildHeaders(spec.auth, authToken, adminToken),
            body: bodyWithoutField,
            expectedStatus: 400,
            description: `Request missing required field '${field}' should be rejected`,
          });
        }
      }
    }

    // 7. Wrong types
    if (spec.requestBody?.properties) {
      for (const [field, fieldSpec] of Object.entries(spec.requestBody.properties)) {
        const bodyWithWrongType = this.generateValidBody(spec.requestBody);
        if (bodyWithWrongType && typeof bodyWithWrongType === 'object') {
          (bodyWithWrongType as Record<string, unknown>)[field] = this.generateWrongTypeValue(fieldSpec.type);
          
          requests.push({
            testCase: `wrong_type_${field}`,
            method: spec.method,
            path: this.fillPathParams(spec.path, spec.params),
            headers: this.buildHeaders(spec.auth, authToken, adminToken),
            body: bodyWithWrongType,
            expectedStatus: 400,
            description: `Request with wrong type for '${field}' should be rejected`,
          });
        }
      }
    }

    return requests;
  }

  private buildHeaders(auth: string, authToken?: string, adminToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth === 'required' && authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    } else if (auth === 'admin' && adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }

    return headers;
  }

  private fillPathParams(path: string, params?: Record<string, any>): string {
    if (!params) return path;

    let filledPath = path;
    for (const [key, constraint] of Object.entries(params)) {
      const value = this.generateValidParamValue(constraint);
      filledPath = filledPath.replace(`:${key}`, String(value));
    }

    return filledPath;
  }

  private generateValidParamValue(constraint: any): string | number {
    if (constraint.type === 'number') {
      return 1;
    }
    return 'test-id-123';
  }

  private generateValidQuery(querySpec: Record<string, any>): Record<string, string> {
    const query: Record<string, string> = {};
    
    for (const [key, constraint] of Object.entries(querySpec)) {
      if (constraint.required) {
        query[key] = String(this.generateValidParamValue(constraint));
      }
    }

    return query;
  }

  private generateValidBody(shape: TypeShape): unknown {
    if (shape.type === 'object' && shape.properties) {
      const obj: Record<string, unknown> = {};
      
      for (const [key, propShape] of Object.entries(shape.properties)) {
        const isRequired = shape.required?.includes(key);
        
        if (isRequired) {
          obj[key] = this.generateValidValue(propShape);
        }
      }

      return obj;
    }

    return this.generateValidValue(shape);
  }

  private generateValidValue(shape: TypeShape): unknown {
    switch (shape.type) {
      case 'string':
        if (shape.enum) return shape.enum[0];
        if (shape.pattern === '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$') {
          return 'test@example.com';
        }
        const minLen = shape.minLength || 1;
        const maxLen = shape.maxLength || 50;
        const len = Math.min(10, maxLen);
        return 'test'.repeat(Math.ceil(len / 4)).slice(0, len);
      
      case 'number':
        const min = shape.min || 0;
        const max = shape.max || 100;
        return Math.floor((min + max) / 2);
      
      case 'boolean':
        return true;
      
      case 'array':
        if (shape.items) {
          return [this.generateValidValue(shape.items)];
        }
        return [];
      
      case 'object':
        if (shape.properties) {
          const obj: Record<string, unknown> = {};
          for (const [key, propShape] of Object.entries(shape.properties)) {
            obj[key] = this.generateValidValue(propShape);
          }
          return obj;
        }
        return {};
      
      case 'null':
        return null;
      
      default:
        return null;
    }
  }

  private generateWrongTypeValue(expectedType: string): unknown {
    // Return a value that's definitely the wrong type
    switch (expectedType) {
      case 'string':
        return 12345;
      case 'number':
        return 'not-a-number';
      case 'boolean':
        return 'not-a-boolean';
      case 'array':
        return { not: 'an-array' };
      case 'object':
        return 'not-an-object';
      default:
        return undefined;
    }
  }
}

export function extractEndpointSpecs(domain: Domain): EndpointSpec[] {
  const specs: EndpointSpec[] = [];

  if (!domain.apis || domain.apis.length === 0) {
    return specs;
  }

  for (const api of domain.apis) {
    if (!api.endpoints) continue;

    for (const endpoint of api.endpoints) {
      specs.push({
        path: endpoint.path,
        method: endpoint.method,
        auth: determineAuthLevel(endpoint),
        requestBody: endpoint.body ? convertToTypeShape(endpoint.body) : undefined,
        responseBody: endpoint.response ? convertToTypeShape(endpoint.response) : undefined,
        params: endpoint.params ? extractParams(endpoint.params) : undefined,
      });
    }
  }

  return specs;
}

function determineAuthLevel(endpoint: EndpointDecl): 'none' | 'required' | 'admin' | 'optional' {
  // Check if endpoint has auth requirement
  if (endpoint.auth === false) return 'none';
  if (endpoint.auth === true) return 'required';
  
  // Check metadata or name patterns
  const path = endpoint.path.toLowerCase();
  if (path.includes('/admin/')) return 'admin';
  if (path.includes('/auth/login') || path.includes('/auth/register')) return 'none';
  
  // Default to required for mutation operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(endpoint.method)) {
    return 'required';
  }

  return 'optional';
}

function convertToTypeShape(typeRef: any): TypeShape | undefined {
  // Simplified type conversion - would need full type resolution in production
  if (!typeRef) return undefined;

  // This is a placeholder - in real implementation, we'd resolve types from the domain
  return {
    type: 'object',
    properties: {},
    required: [],
  };
}

function extractParams(params: any): Record<string, any> | undefined {
  // Extract path parameters
  return undefined;
}
