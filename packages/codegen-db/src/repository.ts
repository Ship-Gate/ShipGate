/**
 * Repository Pattern Generator
 */

import type {
  GeneratorContext,
  GeneratedFile,
  NormalizedEntity,
  NormalizedField,
} from './types.js';
import { toCase } from './generator.js';

export function generateRepositories(context: GeneratorContext): GeneratedFile[] {
  const { entities, options } = context;
  const files: GeneratedFile[] = [];

  // Generate repository for each entity
  for (const entity of entities) {
    switch (options.adapter) {
      case 'prisma':
        files.push(generatePrismaRepository(entity, context));
        break;
      case 'drizzle':
        files.push(generateDrizzleRepository(entity, context));
        break;
      case 'typeorm':
        files.push(generateTypeORMRepository(entity, context));
        break;
    }
  }

  // Generate index file
  files.push(generateRepositoryIndex(entities, options.adapter));

  // Generate types file
  files.push(generateRepositoryTypes(entities));

  return files;
}

// ============================================
// Prisma Repository
// ============================================

function generatePrismaRepository(entity: NormalizedEntity, context: GeneratorContext): GeneratedFile {
  const entityName = entity.name;
  const varName = toCase(entityName, 'camel');
  const lines: string[] = [];

  // Imports
  lines.push(`import { PrismaClient, ${entityName}, Prisma } from '@prisma/client';`);
  lines.push(`import type { Create${entityName}Data, Update${entityName}Data, ${entityName}Filter } from './types';`);
  lines.push('');

  // Interface
  lines.push(`export interface ${entityName}Repository {`);
  lines.push(`  create(data: Create${entityName}Data): Promise<${entityName}>;`);
  lines.push(`  findById(id: string): Promise<${entityName} | null>;`);
  
  // Add findBy methods for unique fields
  const uniqueFields = entity.fields.filter(f => f.unique && !f.primaryKey);
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const paramType = mapFieldToTsType(field);
    lines.push(`  ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | null>;`);
  }

  lines.push(`  findMany(filter?: ${entityName}Filter): Promise<${entityName}[]>;`);
  lines.push(`  update(id: string, data: Update${entityName}Data): Promise<${entityName}>;`);
  lines.push(`  delete(id: string): Promise<void>;`);
  lines.push(`  exists(filter: ${entityName}Filter): Promise<boolean>;`);
  lines.push(`  count(filter?: ${entityName}Filter): Promise<number>;`);
  lines.push('}');
  lines.push('');

  // Implementation
  lines.push(`export class Prisma${entityName}Repository implements ${entityName}Repository {`);
  lines.push('  constructor(private prisma: PrismaClient) {}');
  lines.push('');

  // create
  lines.push(`  async create(data: Create${entityName}Data): Promise<${entityName}> {`);
  lines.push(`    return this.prisma.${varName}.create({ data });`);
  lines.push('  }');
  lines.push('');

  // findById
  lines.push(`  async findById(id: string): Promise<${entityName} | null> {`);
  lines.push(`    return this.prisma.${varName}.findUnique({ where: { id } });`);
  lines.push('  }');
  lines.push('');

  // findBy methods for unique fields
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const paramType = mapFieldToTsType(field);
    lines.push(`  async ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | null> {`);
    lines.push(`    return this.prisma.${varName}.findUnique({ where: { ${field.name} } });`);
    lines.push('  }');
    lines.push('');
  }

  // findMany
  lines.push(`  async findMany(filter?: ${entityName}Filter): Promise<${entityName}[]> {`);
  lines.push(`    return this.prisma.${varName}.findMany({`);
  lines.push('      where: filter,');
  lines.push('      orderBy: { createdAt: \'desc\' },');
  lines.push('    });');
  lines.push('  }');
  lines.push('');

  // update
  lines.push(`  async update(id: string, data: Update${entityName}Data): Promise<${entityName}> {`);
  lines.push(`    return this.prisma.${varName}.update({`);
  lines.push('      where: { id },');
  lines.push('      data,');
  lines.push('    });');
  lines.push('  }');
  lines.push('');

  // delete
  lines.push('  async delete(id: string): Promise<void> {');
  if (context.options.softDelete) {
    lines.push(`    await this.prisma.${varName}.update({`);
    lines.push('      where: { id },');
    lines.push('      data: { deletedAt: new Date() },');
    lines.push('    });');
  } else {
    lines.push(`    await this.prisma.${varName}.delete({ where: { id } });`);
  }
  lines.push('  }');
  lines.push('');

  // exists
  lines.push(`  async exists(filter: ${entityName}Filter): Promise<boolean> {`);
  lines.push(`    const count = await this.prisma.${varName}.count({ where: filter });`);
  lines.push('    return count > 0;');
  lines.push('  }');
  lines.push('');

  // count
  lines.push(`  async count(filter?: ${entityName}Filter): Promise<number> {`);
  lines.push(`    return this.prisma.${varName}.count({ where: filter });`);
  lines.push('  }');

  lines.push('}');

  return {
    path: `repositories/${entityName}Repository.ts`,
    content: lines.join('\n'),
    type: 'typescript',
  };
}

// ============================================
// Drizzle Repository
// ============================================

function generateDrizzleRepository(entity: NormalizedEntity, context: GeneratorContext): GeneratedFile {
  const entityName = entity.name;
  const tableName = toCase(entityName, 'camel');
  const lines: string[] = [];

  // Imports
  lines.push("import { eq, and, sql } from 'drizzle-orm';");
  lines.push("import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';");
  lines.push(`import { ${tableName}, type ${entityName}, type New${entityName} } from '../schema';`);
  lines.push(`import type { Update${entityName}Data, ${entityName}Filter } from './types';`);
  lines.push('');

  // Interface
  lines.push(`export interface ${entityName}Repository {`);
  lines.push(`  create(data: New${entityName}): Promise<${entityName}>;`);
  lines.push(`  findById(id: string): Promise<${entityName} | undefined>;`);
  
  const uniqueFields = entity.fields.filter(f => f.unique && !f.primaryKey);
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const paramType = mapFieldToTsType(field);
    lines.push(`  ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | undefined>;`);
  }

  lines.push(`  findMany(filter?: ${entityName}Filter): Promise<${entityName}[]>;`);
  lines.push(`  update(id: string, data: Update${entityName}Data): Promise<${entityName}>;`);
  lines.push('  delete(id: string): Promise<void>;');
  lines.push(`  exists(filter: ${entityName}Filter): Promise<boolean>;`);
  lines.push(`  count(filter?: ${entityName}Filter): Promise<number>;`);
  lines.push('}');
  lines.push('');

  // Implementation
  lines.push(`export class Drizzle${entityName}Repository implements ${entityName}Repository {`);
  lines.push('  constructor(private db: PostgresJsDatabase) {}');
  lines.push('');

  // create
  lines.push(`  async create(data: New${entityName}): Promise<${entityName}> {`);
  lines.push(`    const [result] = await this.db.insert(${tableName}).values(data).returning();`);
  lines.push('    return result;');
  lines.push('  }');
  lines.push('');

  // findById
  lines.push(`  async findById(id: string): Promise<${entityName} | undefined> {`);
  lines.push(`    const [result] = await this.db.select().from(${tableName}).where(eq(${tableName}.id, id));`);
  lines.push('    return result;');
  lines.push('  }');
  lines.push('');

  // findBy methods for unique fields
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const fieldName = toCase(field.name, 'camel');
    const paramType = mapFieldToTsType(field);
    lines.push(`  async ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | undefined> {`);
    lines.push(`    const [result] = await this.db.select().from(${tableName}).where(eq(${tableName}.${fieldName}, ${field.name}));`);
    lines.push('    return result;');
    lines.push('  }');
    lines.push('');
  }

  // findMany
  lines.push(`  async findMany(_filter?: ${entityName}Filter): Promise<${entityName}[]> {`);
  lines.push(`    return this.db.select().from(${tableName});`);
  lines.push('  }');
  lines.push('');

  // update
  lines.push(`  async update(id: string, data: Update${entityName}Data): Promise<${entityName}> {`);
  lines.push(`    const [result] = await this.db.update(${tableName}).set(data).where(eq(${tableName}.id, id)).returning();`);
  lines.push('    return result;');
  lines.push('  }');
  lines.push('');

  // delete
  lines.push('  async delete(id: string): Promise<void> {');
  if (context.options.softDelete) {
    lines.push(`    await this.db.update(${tableName}).set({ deletedAt: new Date() }).where(eq(${tableName}.id, id));`);
  } else {
    lines.push(`    await this.db.delete(${tableName}).where(eq(${tableName}.id, id));`);
  }
  lines.push('  }');
  lines.push('');

  // exists
  lines.push(`  async exists(filter: ${entityName}Filter): Promise<boolean> {`);
  lines.push('    const count = await this.count(filter);');
  lines.push('    return count > 0;');
  lines.push('  }');
  lines.push('');

  // count
  lines.push(`  async count(_filter?: ${entityName}Filter): Promise<number> {`);
  lines.push(`    const [result] = await this.db.select({ count: sql<number>\`count(*)\` }).from(${tableName});`);
  lines.push('    return result.count;');
  lines.push('  }');

  lines.push('}');

  return {
    path: `repositories/${entityName}Repository.ts`,
    content: lines.join('\n'),
    type: 'typescript',
  };
}

// ============================================
// TypeORM Repository
// ============================================

function generateTypeORMRepository(entity: NormalizedEntity, context: GeneratorContext): GeneratedFile {
  const entityName = entity.name;
  const lines: string[] = [];

  // Imports
  lines.push(`import { Repository, DataSource } from 'typeorm';`);
  lines.push(`import { ${entityName} } from '../entities/${entityName}';`);
  lines.push(`import type { Create${entityName}Data, Update${entityName}Data, ${entityName}Filter } from './types';`);
  lines.push('');

  // Interface
  lines.push(`export interface ${entityName}RepositoryInterface {`);
  lines.push(`  create(data: Create${entityName}Data): Promise<${entityName}>;`);
  lines.push(`  findById(id: string): Promise<${entityName} | null>;`);
  
  const uniqueFields = entity.fields.filter(f => f.unique && !f.primaryKey);
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const paramType = mapFieldToTsType(field);
    lines.push(`  ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | null>;`);
  }

  lines.push(`  findMany(filter?: ${entityName}Filter): Promise<${entityName}[]>;`);
  lines.push(`  update(id: string, data: Update${entityName}Data): Promise<${entityName}>;`);
  lines.push('  delete(id: string): Promise<void>;');
  lines.push(`  exists(filter: ${entityName}Filter): Promise<boolean>;`);
  lines.push(`  count(filter?: ${entityName}Filter): Promise<number>;`);
  lines.push('}');
  lines.push('');

  // Implementation
  lines.push(`export class TypeORM${entityName}Repository implements ${entityName}RepositoryInterface {`);
  lines.push(`  private repository: Repository<${entityName}>;`);
  lines.push('');
  lines.push('  constructor(dataSource: DataSource) {');
  lines.push(`    this.repository = dataSource.getRepository(${entityName});`);
  lines.push('  }');
  lines.push('');

  // create
  lines.push(`  async create(data: Create${entityName}Data): Promise<${entityName}> {`);
  lines.push('    const entity = this.repository.create(data);');
  lines.push('    return this.repository.save(entity);');
  lines.push('  }');
  lines.push('');

  // findById
  lines.push(`  async findById(id: string): Promise<${entityName} | null> {`);
  lines.push('    return this.repository.findOneBy({ id });');
  lines.push('  }');
  lines.push('');

  // findBy methods for unique fields
  for (const field of uniqueFields) {
    const methodName = `findBy${capitalize(field.name)}`;
    const paramType = mapFieldToTsType(field);
    lines.push(`  async ${methodName}(${field.name}: ${paramType}): Promise<${entityName} | null> {`);
    lines.push(`    return this.repository.findOneBy({ ${field.name} } as any);`);
    lines.push('  }');
    lines.push('');
  }

  // findMany
  lines.push(`  async findMany(filter?: ${entityName}Filter): Promise<${entityName}[]> {`);
  lines.push('    return this.repository.find({ where: filter as any });');
  lines.push('  }');
  lines.push('');

  // update
  lines.push(`  async update(id: string, data: Update${entityName}Data): Promise<${entityName}> {`);
  lines.push('    await this.repository.update(id, data);');
  lines.push('    const updated = await this.findById(id);');
  lines.push('    if (!updated) throw new Error(`${entityName} not found: ${id}`);');
  lines.push('    return updated;');
  lines.push('  }');
  lines.push('');

  // delete
  lines.push('  async delete(id: string): Promise<void> {');
  if (context.options.softDelete) {
    lines.push('    await this.repository.softDelete(id);');
  } else {
    lines.push('    await this.repository.delete(id);');
  }
  lines.push('  }');
  lines.push('');

  // exists
  lines.push(`  async exists(filter: ${entityName}Filter): Promise<boolean> {`);
  lines.push('    const count = await this.repository.countBy(filter as any);');
  lines.push('    return count > 0;');
  lines.push('  }');
  lines.push('');

  // count
  lines.push(`  async count(filter?: ${entityName}Filter): Promise<number> {`);
  lines.push('    return this.repository.countBy(filter as any ?? {});');
  lines.push('  }');

  lines.push('}');

  return {
    path: `repositories/${entityName}Repository.ts`,
    content: lines.join('\n'),
    type: 'typescript',
  };
}

// ============================================
// Helper Functions
// ============================================

function generateRepositoryIndex(entities: NormalizedEntity[], adapter: string): GeneratedFile {
  const lines: string[] = [];

  for (const entity of entities) {
    lines.push(`export * from './${entity.name}Repository';`);
  }
  lines.push("export * from './types';");

  return {
    path: 'repositories/index.ts',
    content: lines.join('\n'),
    type: 'typescript',
  };
}

function generateRepositoryTypes(entities: NormalizedEntity[]): GeneratedFile {
  const lines: string[] = [];

  for (const entity of entities) {
    // Create type (all fields except auto-generated)
    const createFields = entity.fields
      .filter(f => !f.autoGenerate && !isTimestampField(f))
      .map(f => {
        const optional = f.nullable || f.defaultValue ? '?' : '';
        return `  ${toCase(f.name, 'camel')}${optional}: ${mapFieldToTsType(f)};`;
      });

    lines.push(`export interface Create${entity.name}Data {`);
    lines.push(createFields.join('\n'));
    lines.push('}');
    lines.push('');

    // Update type (all fields optional except id)
    const updateFields = entity.fields
      .filter(f => !f.primaryKey && !f.immutable && !isTimestampField(f))
      .map(f => `  ${toCase(f.name, 'camel')}?: ${mapFieldToTsType(f)};`);

    lines.push(`export interface Update${entity.name}Data {`);
    lines.push(updateFields.join('\n'));
    lines.push('}');
    lines.push('');

    // Filter type
    const filterFields = entity.fields
      .filter(f => !f.type.isArray)
      .map(f => `  ${toCase(f.name, 'camel')}?: ${mapFieldToTsType(f)};`);

    lines.push(`export interface ${entity.name}Filter {`);
    lines.push(filterFields.join('\n'));
    lines.push('}');
    lines.push('');
  }

  return {
    path: 'repositories/types.ts',
    content: lines.join('\n'),
    type: 'typescript',
  };
}

function mapFieldToTsType(field: NormalizedField): string {
  if (field.type.kind === 'enum') {
    return field.type.enumName || field.type.name;
  }

  const scalarType = field.type.scalarType || 'String';
  const mapping: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    DateTime: 'Date',
    UUID: 'string',
    BigInt: 'bigint',
    Decimal: 'string',
    Json: 'Record<string, unknown>',
    Bytes: 'Buffer',
  };

  let tsType = mapping[scalarType] || 'string';

  if (field.type.isArray) {
    tsType = `${tsType}[]`;
  }

  return tsType;
}

function isTimestampField(field: NormalizedField): boolean {
  const name = field.name.toLowerCase();
  return (
    field.type.scalarType === 'DateTime' &&
    (name.includes('created') || name.includes('updated') || name === 'createdat' || name === 'updatedat')
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
