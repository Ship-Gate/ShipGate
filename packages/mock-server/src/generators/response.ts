/**
 * Response Generator
 *
 * Generate mock responses based on ISL types and entities.
 */

import { DataGenerator } from './data.js';
import { MockState } from '../state.js';

export interface GeneratorOptions {
  /** Data generator instance */
  dataGenerator: DataGenerator;
  /** State manager instance */
  state: MockState;
  /** Merge input values into response */
  mergeInput?: boolean;
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}

export class ResponseGenerator {
  private dataGenerator: DataGenerator;
  private state: MockState;
  private mergeInput: boolean;

  constructor(options: GeneratorOptions) {
    this.dataGenerator = options.dataGenerator;
    this.state = options.state;
    this.mergeInput = options.mergeInput ?? true;
  }

  /**
   * Generate response for an entity
   */
  generateEntity(entity: ParsedEntity, input?: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const field of entity.fields) {
      // Skip optional fields randomly
      if (field.optional && Math.random() > 0.7) {
        continue;
      }

      // Use input value if provided and field exists in input
      if (this.mergeInput && input && field.name in input) {
        result[field.name] = input[field.name];
        continue;
      }

      // Check for special annotations
      if (field.annotations.includes('immutable')) {
        // Generate once, don't change
        if (input && input[field.name]) {
          result[field.name] = input[field.name];
          continue;
        }
      }

      // Generate based on field type and annotations
      result[field.name] = this.generateField(field);
    }

    return result;
  }

  /**
   * Generate value for a field
   */
  generateField(field: ParsedField): unknown {
    const { name, type, annotations } = field;

    // Handle common field names
    if (name === 'id' || name.endsWith('_id') || name.endsWith('Id')) {
      return this.dataGenerator.uuid();
    }

    if (name === 'email' || name.includes('email')) {
      return this.dataGenerator.email();
    }

    if (name === 'password' || name.includes('password')) {
      return this.dataGenerator.password();
    }

    if (name === 'name' || name === 'username') {
      return this.dataGenerator.fullName();
    }

    if (name === 'first_name' || name === 'firstName') {
      return this.dataGenerator.firstName();
    }

    if (name === 'last_name' || name === 'lastName') {
      return this.dataGenerator.lastName();
    }

    if (name === 'phone' || name.includes('phone')) {
      return this.dataGenerator.phone();
    }

    if (name === 'address' || name.includes('address')) {
      return this.dataGenerator.address();
    }

    if (name === 'city') {
      return this.dataGenerator.city();
    }

    if (name === 'country') {
      return this.dataGenerator.country();
    }

    if (name === 'url' || name.includes('url') || name.includes('link')) {
      return this.dataGenerator.url();
    }

    if (name === 'image' || name.includes('image') || name.includes('avatar')) {
      return this.dataGenerator.imageUrl();
    }

    if (name === 'description' || name === 'bio' || name === 'summary') {
      return this.dataGenerator.paragraph();
    }

    if (name === 'title' || name === 'subject') {
      return this.dataGenerator.sentence();
    }

    if (name.includes('created') || name.includes('updated') || name.includes('_at')) {
      return this.dataGenerator.timestamp();
    }

    if (name === 'status') {
      return this.dataGenerator.enumValue(['ACTIVE', 'INACTIVE', 'PENDING', 'COMPLETED']);
    }

    if (name.includes('amount') || name.includes('price') || name.includes('total')) {
      return this.dataGenerator.decimal(0, 1000, 2);
    }

    if (name.includes('count') || name.includes('quantity')) {
      return this.dataGenerator.integer(0, 100);
    }

    if (name.includes('percentage') || name.includes('rate')) {
      return this.dataGenerator.decimal(0, 100, 2);
    }

    // Check annotations
    if (annotations.includes('secret') || annotations.includes('sensitive')) {
      return '[REDACTED]';
    }

    // Generate based on type
    return this.generateType(type);
  }

  /**
   * Generate value for a type
   */
  generateType(type: string): unknown {
    switch (type) {
      case 'String':
        return this.dataGenerator.word();
      case 'Int':
        return this.dataGenerator.integer(0, 1000);
      case 'Float':
      case 'Decimal':
        return this.dataGenerator.decimal(0, 1000, 2);
      case 'Boolean':
        return this.dataGenerator.boolean();
      case 'UUID':
        return this.dataGenerator.uuid();
      case 'Timestamp':
      case 'DateTime':
        return this.dataGenerator.timestamp();
      case 'Date':
        return this.dataGenerator.date();
      case 'Duration':
        return this.dataGenerator.duration();
      case 'Email':
        return this.dataGenerator.email();
      case 'URL':
        return this.dataGenerator.url();
      case 'JSON':
        return this.dataGenerator.json();
      case 'Void':
        return null;
      default:
        // Check if it's a List type
        if (type.startsWith('List<')) {
          const innerType = type.slice(5, -1);
          const count = this.dataGenerator.integer(1, 5);
          return Array.from({ length: count }, () => this.generateType(innerType));
        }

        // Check if it's a Map type
        if (type.startsWith('Map<')) {
          const [keyType, valueType] = type.slice(4, -1).split(',').map((t) => t.trim());
          const result: Record<string, unknown> = {};
          const count = this.dataGenerator.integer(1, 3);
          for (let i = 0; i < count; i++) {
            const key = String(this.generateType(keyType));
            result[key] = this.generateType(valueType);
          }
          return result;
        }

        // Unknown type - return a string
        return this.dataGenerator.word();
    }
  }

  /**
   * Generate success response for a behavior
   */
  generateSuccessResponse(
    successType: string,
    entity?: ParsedEntity,
    input?: Record<string, unknown>
  ): unknown {
    if (entity) {
      return this.generateEntity(entity, input);
    }

    return this.generateType(successType);
  }

  /**
   * Generate a list of entities
   */
  generateEntityList(
    entity: ParsedEntity,
    count: number = 5
  ): Record<string, unknown>[] {
    return Array.from({ length: count }, () => this.generateEntity(entity));
  }

  /**
   * Generate paginated response
   */
  generatePaginatedResponse(
    entity: ParsedEntity,
    page: number = 1,
    pageSize: number = 10,
    total?: number
  ): {
    items: Record<string, unknown>[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } {
    const actualTotal = total ?? this.dataGenerator.integer(pageSize, pageSize * 5);
    const totalPages = Math.ceil(actualTotal / pageSize);
    const itemCount = Math.min(pageSize, actualTotal - (page - 1) * pageSize);

    return {
      items: this.generateEntityList(entity, Math.max(0, itemCount)),
      page,
      pageSize,
      total: actualTotal,
      totalPages,
    };
  }

  /**
   * Generate wrapped response with metadata
   */
  generateWrappedResponse(
    data: unknown,
    options?: {
      includeTimestamp?: boolean;
      includeRequestId?: boolean;
      success?: boolean;
    }
  ): Record<string, unknown> {
    const response: Record<string, unknown> = {
      data,
    };

    if (options?.success !== undefined) {
      response.success = options.success;
    }

    if (options?.includeTimestamp) {
      response.timestamp = this.dataGenerator.timestamp();
    }

    if (options?.includeRequestId) {
      response.requestId = this.dataGenerator.uuid();
    }

    return response;
  }
}
