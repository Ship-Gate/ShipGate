/**
 * Schema registry implementation
 */

import type { 
  Schema, 
  SchemaRegistry as ISchemaRegistry,
  SchemaStore,
  ValidationResult,
  ValidationError,
  CompatibilityResult,
  CompatibilityIssue,
  SchemaCompatibility,
  SchemaMigration,
  SchemaMigrator,
} from './types.js';
import { 
  SchemaNotFoundError, 
  SchemaValidationError,
  IncompatibleSchemaError 
} from '../errors.js';

// ============================================================================
// IN-MEMORY SCHEMA STORE
// ============================================================================

export class InMemorySchemaStore implements SchemaStore {
  private schemas = new Map<string, Map<string, Schema>>();
  
  async store(schema: Schema): Promise<void> {
    if (!this.schemas.has(schema.id)) {
      this.schemas.set(schema.id, new Map());
    }
    
    const versions = this.schemas.get(schema.id)!;
    versions.set(schema.version, schema);
  }
  
  async retrieve(schemaId: string, version?: string): Promise<Schema | null> {
    const versions = this.schemas.get(schemaId);
    if (!versions) {
      return null;
    }
    
    if (version) {
      return versions.get(version) || null;
    }
    
    // Return latest version
    const sortedVersions = Array.from(versions.keys()).sort(this.compareVersions);
    return versions.get(sortedVersions[sortedVersions.length - 1]) || null;
  }
  
  async list(): Promise<Array<{ id: string; version: string; createdAt: number; description?: string }>> {
    const result: Array<{ id: string; version: string; createdAt: number; description?: string }> = [];
    
    for (const [schemaId, versions] of this.schemas) {
      for (const [version, schema] of versions) {
        result.push({
          id: schemaId,
          version,
          createdAt: Date.now(), // Would be stored in real implementation
          description: schema.definition?.description,
        });
      }
    }
    
    return result;
  }
  
  async delete(schemaId: string, version?: string): Promise<void> {
    if (!this.schemas.has(schemaId)) {
      throw new SchemaNotFoundError(schemaId);
    }
    
    if (version) {
      const versions = this.schemas.get(schemaId)!;
      versions.delete(version);
      
      if (versions.size === 0) {
        this.schemas.delete(schemaId);
      }
    } else {
      this.schemas.delete(schemaId);
    }
  }
  
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  }
}

// ============================================================================
// JSON SCHEMA VALIDATOR
// ============================================================================

export class JsonSchemaValidator {
  /**
   * Validate data against a JSON schema
   */
  static validate(data: any, schema: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Simple validation implementation
    // In production, would use a proper JSON schema validator like ajv
    this.validateValue(data, schema, '', errors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  private static validateValue(
    data: any,
    schema: any,
    path: string,
    errors: ValidationError[]
  ): void {
    if (!schema || typeof schema !== 'object') {
      return;
    }
    
    // Type validation
    if (schema.type) {
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      if (dataType !== schema.type) {
        errors.push({
          message: `Expected type ${schema.type}, got ${dataType}`,
          path,
          code: 'TYPE_MISMATCH',
        });
        return;
      }
    }
    
    // Required properties
    if (schema.required && typeof data === 'object' && data !== null) {
      for (const required of schema.required) {
        if (!(required in data)) {
          errors.push({
            message: `Required property '${required}' is missing`,
            path: path ? `${path}.${required}` : required,
            code: 'REQUIRED_PROPERTY_MISSING',
          });
        }
      }
    }
    
    // Properties validation
    if (schema.properties && typeof data === 'object' && data !== null) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in data) {
          this.validateValue(
            data[propName],
            propSchema,
            path ? `${path}.${propName}` : propName,
            errors
          );
        }
      }
    }
    
    // Array validation
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.items) {
        data.forEach((item, index) => {
          this.validateValue(
            item,
            schema.items,
            `${path}[${index}]`,
            errors
          );
        });
      }
    }
  }
}

// ============================================================================
// DEFAULT SCHEMA REGISTRY
// ============================================================================

export class DefaultSchemaRegistry implements ISchemaRegistry {
  private migrations = new Map<string, SchemaMigration[]>();
  
  constructor(private readonly store: SchemaStore) {}
  
  async register(schema: Schema): Promise<void> {
    await this.store.store(schema);
  }
  
  async get(schemaId: string): Promise<Schema | null> {
    return this.store.retrieve(schemaId);
  }
  
  async getVersion(schemaId: string, version: string): Promise<Schema | null> {
    return this.store.retrieve(schemaId, version);
  }
  
  async listVersions(schemaId: string): Promise<string[]> {
    const schemas = await this.store.list();
    return schemas
      .filter(s => s.id === schemaId)
      .map(s => s.version)
      .sort((a, b) => this.compareVersions(b, a)); // Descending order
  }
  
  async validate(schemaId: string, data: any, version?: string): Promise<ValidationResult> {
    const schema = await this.store.retrieve(schemaId, version);
    if (!schema) {
      throw new SchemaNotFoundError(schemaId);
    }
    
    return JsonSchemaValidator.validate(data, schema.definition);
  }
  
  async checkCompatibility(
    schemaId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<CompatibilityResult> {
    const fromSchema = await this.store.retrieve(schemaId, fromVersion);
    const toSchema = await this.store.retrieve(schemaId, toVersion);
    
    if (!fromSchema || !toSchema) {
      throw new SchemaNotFoundError(schemaId);
    }
    
    const issues: CompatibilityIssue[] = [];
    let compatible = true;
    
    // Check compatibility based on schema's compatibility mode
    switch (toSchema.compatibility) {
      case SchemaCompatibility.BACKWARD:
        // New readers can read old data
        issues.push(...this.checkBackwardCompatibility(fromSchema, toSchema));
        break;
        
      case SchemaCompatibility.FORWARD:
        // Old readers can read new data
        issues.push(...this.checkForwardCompatibility(fromSchema, toSchema));
        break;
        
      case SchemaCompatibility.FULL:
        // Both backward and forward
        issues.push(...this.checkBackwardCompatibility(fromSchema, toSchema));
        issues.push(...this.checkForwardCompatibility(fromSchema, toSchema));
        break;
    }
    
    compatible = issues.filter(i => i.severity === 'error').length === 0;
    
    return {
      compatible,
      compatibility: toSchema.compatibility,
      issues,
    };
  }
  
  async evolve(schemaId: string, newSchema: Schema): Promise<void> {
    const existingVersions = await this.listVersions(schemaId);
    
    if (existingVersions.length > 0) {
      // Check compatibility
      const latestVersion = existingVersions[0];
      const compatibility = await this.checkCompatibility(
        schemaId,
        latestVersion,
        newSchema.version
      );
      
      if (!compatibility.compatible) {
        throw new IncompatibleSchemaError(
          schemaId,
          newSchema.version
        );
      }
    }
    
    await this.store.store(newSchema);
  }
  
  private checkBackwardCompatibility(
    fromSchema: Schema,
    toSchema: Schema
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    
    // Check for removed required fields
    if (fromSchema.definition?.required && toSchema.definition?.required) {
      for (const field of fromSchema.definition.required) {
        if (!toSchema.definition.required.includes(field)) {
          issues.push({
            description: `Required field '${field}' was removed`,
            severity: 'error',
            field,
          });
        }
      }
    }
    
    // Check for type changes
    if (fromSchema.definition?.properties && toSchema.definition?.properties) {
      for (const [field, fromProp] of Object.entries(fromSchema.definition.properties)) {
        const toProp = toSchema.definition.properties[field];
        if (toProp && fromProp.type !== toProp.type) {
          issues.push({
            description: `Type of field '${field}' changed from ${fromProp.type} to ${toProp.type}`,
            severity: 'error',
            field,
          });
        }
      }
    }
    
    return issues;
  }
  
  private checkForwardCompatibility(
    fromSchema: Schema,
    toSchema: Schema
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];
    
    // Check for new required fields
    if (fromSchema.definition?.required && toSchema.definition?.required) {
      for (const field of toSchema.definition.required) {
        if (!fromSchema.definition.required.includes(field)) {
          issues.push({
            description: `New required field '${field}' was added`,
            severity: 'warning',
            field,
          });
        }
      }
    }
    
    return issues;
  }
  
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  }
}

// ============================================================================
// DEFAULT SCHEMA MIGRATOR
// ============================================================================

export class DefaultSchemaMigrator implements SchemaMigrator {
  private migrations = new Map<string, Map<string, SchemaMigration>>();
  
  register(schemaId: string, migration: SchemaMigration): void {
    if (!this.migrations.has(schemaId)) {
      this.migrations.set(schemaId, new Map());
    }
    
    const key = `${migration.fromVersion}->${migration.toVersion}`;
    this.migrations.get(schemaId)!.set(key, migration);
  }
  
  async migrate(
    schemaId: string,
    data: any,
    fromVersion: string,
    toVersion: string
  ): Promise<any> {
    const path = this.getMigrationPath(schemaId, fromVersion, toVersion);
    
    let current = data;
    for (const migration of path) {
      current = migration.migrate(current);
    }
    
    return current;
  }
  
  getMigrationPath(
    schemaId: string,
    fromVersion: string,
    toVersion: string
  ): SchemaMigration[] {
    const migrations = this.migrations.get(schemaId);
    if (!migrations) {
      throw new Error(`No migrations registered for schema: ${schemaId}`);
    }
    
    // Simple path finding - in production would use graph traversal
    const path: SchemaMigration[] = [];
    let currentVersion = fromVersion;
    
    while (currentVersion !== toVersion) {
      const key = `${currentVersion}->${toVersion}`;
      const migration = migrations.get(key);
      
      if (!migration) {
        throw new Error(
          `No migration path from ${fromVersion} to ${toVersion} for schema: ${schemaId}`
        );
      }
      
      path.push(migration);
      currentVersion = migration.toVersion;
    }
    
    return path;
  }
}
