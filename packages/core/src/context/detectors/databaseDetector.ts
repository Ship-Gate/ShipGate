/**
 * Database Detector
 * 
 * Detects database technologies and ORMs, and extracts entity information.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DatabaseTech, DetectedEntity, DetectedField, Confidence } from '../contextTypes.js';

export interface DatabaseDetection {
  tech: DatabaseTech;
  confidence: Confidence;
  source: string;
}

/**
 * Database/ORM detection patterns
 */
const DATABASE_PATTERNS: Record<DatabaseTech, { packages: string[]; configs: string[] }> = {
  prisma: {
    packages: ['prisma', '@prisma/client'],
    configs: ['prisma/schema.prisma'],
  },
  drizzle: {
    packages: ['drizzle-orm'],
    configs: ['drizzle.config.ts'],
  },
  typeorm: {
    packages: ['typeorm'],
    configs: ['ormconfig.json', 'ormconfig.js'],
  },
  sequelize: {
    packages: ['sequelize'],
    configs: ['.sequelizerc'],
  },
  mongoose: {
    packages: ['mongoose'],
    configs: [],
  },
  knex: {
    packages: ['knex'],
    configs: ['knexfile.js', 'knexfile.ts'],
  },
  sqlalchemy: {
    packages: ['sqlalchemy'],
    configs: [],
  },
  gorm: {
    packages: ['gorm.io/gorm'],
    configs: [],
  },
  postgres: {
    packages: ['pg', 'postgres'],
    configs: [],
  },
  mysql: {
    packages: ['mysql', 'mysql2'],
    configs: [],
  },
  mongodb: {
    packages: ['mongodb'],
    configs: [],
  },
  sqlite: {
    packages: ['better-sqlite3', 'sqlite3'],
    configs: [],
  },
  redis: {
    packages: ['redis', 'ioredis'],
    configs: [],
  },
  unknown: {
    packages: [],
    configs: [],
  },
};

/**
 * Detects database technologies in the workspace
 */
export async function detectDatabases(workspacePath: string): Promise<DatabaseDetection[]> {
  const detected: DatabaseDetection[] = [];

  // Check package.json
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [tech, patterns] of Object.entries(DATABASE_PATTERNS)) {
      if (tech === 'unknown') continue;

      for (const pkg of patterns.packages) {
        if (allDeps[pkg]) {
          detected.push({
            tech: tech as DatabaseTech,
            confidence: 'high',
            source: `package.json (${pkg})`,
          });
          break;
        }
      }
    }
  } catch {
    // No package.json
  }

  // Check for config files
  for (const [tech, patterns] of Object.entries(DATABASE_PATTERNS)) {
    if (tech === 'unknown') continue;

    for (const config of patterns.configs) {
      try {
        await fs.access(path.join(workspacePath, config));
        if (!detected.some(d => d.tech === tech)) {
          detected.push({
            tech: tech as DatabaseTech,
            confidence: 'high',
            source: config,
          });
        }
        break;
      } catch {
        // Config not found
      }
    }
  }

  return detected;
}

/**
 * Extracts entities from a Prisma schema
 */
export async function extractPrismaEntities(workspacePath: string): Promise<DetectedEntity[]> {
  const entities: DetectedEntity[] = [];
  const schemaPath = path.join(workspacePath, 'prisma', 'schema.prisma');

  try {
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Simple regex-based parsing for model definitions
    // Pattern: model ModelName { ... }
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(schema)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      
      if (!modelName || !modelBody) continue;

      const fields = extractPrismaFields(modelBody);

      entities.push({
        name: modelName,
        source: 'prisma',
        sourceFile: 'prisma/schema.prisma',
        fields,
        confidence: 'high',
      });
    }
  } catch {
    // No Prisma schema or unreadable
  }

  return entities;
}

/**
 * Extract fields from Prisma model body
 */
function extractPrismaFields(modelBody: string): DetectedField[] {
  const fields: DetectedField[] = [];
  const lines = modelBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    // Pattern: fieldName Type @attributes
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?(\[\])?\s*(.*)?$/);
    if (!fieldMatch) continue;

    const [, name, type, optional, , attributes = ''] = fieldMatch;
    if (!name || !type) continue;

    // Skip relation fields (they have @relation attribute)
    if (attributes.includes('@relation')) continue;

    const field: DetectedField = {
      name,
      type,
      isOptional: !!optional,
      isId: attributes.includes('@id'),
      isUnique: attributes.includes('@unique') || attributes.includes('@id'),
      isTimestamp: type === 'DateTime' || name.includes('At') || name.includes('_at'),
    };

    fields.push(field);
  }

  return fields;
}

/**
 * Extracts entities from Mongoose models
 */
export async function extractMongooseEntities(workspacePath: string): Promise<DetectedEntity[]> {
  const entities: DetectedEntity[] = [];
  
  // Common paths for Mongoose models
  const modelPaths = [
    'models',
    'src/models',
    'app/models',
    'lib/models',
    'server/models',
  ];

  for (const modelPath of modelPaths) {
    try {
      const fullPath = path.join(workspacePath, modelPath);
      const files = await fs.readdir(fullPath);
      
      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
        
        const filePath = path.join(fullPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Look for mongoose.model() or Schema definitions
        const modelMatch = content.match(/mongoose\.model\s*\(\s*['"](\w+)['"]/);
        const schemaMatch = content.match(/new\s+(?:mongoose\.)?Schema\s*\(/);
        
        if (modelMatch || schemaMatch) {
          const name = modelMatch?.[1] || path.basename(file, path.extname(file));
          
          // Only add if we're confident this is a model
          if (schemaMatch) {
            entities.push({
              name: capitalize(name),
              source: 'mongoose',
              sourceFile: path.join(modelPath, file),
              confidence: modelMatch ? 'high' : 'medium',
            });
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return entities;
}

/**
 * Extracts entities from TypeORM decorators
 */
export async function extractTypeORMEntities(workspacePath: string): Promise<DetectedEntity[]> {
  const entities: DetectedEntity[] = [];
  
  // Common paths for TypeORM entities
  const entityPaths = [
    'entities',
    'src/entities',
    'src/entity',
    'app/entities',
    'lib/entities',
  ];

  for (const entityPath of entityPaths) {
    try {
      const fullPath = path.join(workspacePath, entityPath);
      const files = await fs.readdir(fullPath);
      
      for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        
        const filePath = path.join(fullPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Look for @Entity() decorator
        const entityMatch = content.match(/@Entity\s*\(\s*(?:['"](\w+)['"])?\s*\)/);
        const classMatch = content.match(/class\s+(\w+)/);
        
        if (entityMatch) {
          const name = entityMatch[1] || classMatch?.[1] || path.basename(file, '.ts');
          
          entities.push({
            name: capitalize(name),
            source: 'typeorm',
            sourceFile: path.join(entityPath, file),
            confidence: 'high',
          });
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return entities;
}

/**
 * Extract all entities from detected database technologies
 */
export async function extractEntities(
  workspacePath: string,
  databases: DatabaseDetection[]
): Promise<DetectedEntity[]> {
  const entities: DetectedEntity[] = [];

  for (const db of databases) {
    switch (db.tech) {
      case 'prisma':
        entities.push(...await extractPrismaEntities(workspacePath));
        break;
      case 'mongoose':
        entities.push(...await extractMongooseEntities(workspacePath));
        break;
      case 'typeorm':
        entities.push(...await extractTypeORMEntities(workspacePath));
        break;
      // Add more extractors as needed
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return entities.filter(e => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
