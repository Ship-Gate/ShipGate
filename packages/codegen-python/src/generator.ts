// ============================================================================
// Python Code Generator
// ============================================================================

import type {
  Domain,
  Entity,
  Behavior,
  PythonGeneratorOptions,
  GeneratedFile,
  GenerationResult,
} from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { generatePydanticModel, generateBehaviorModels } from './templates/pydantic.js';
import {
  generateFastAPIRouter,
  generateFastAPIMain,
  generateService,
  generateDependencies,
} from './templates/fastapi.js';

/**
 * Python Code Generator
 * 
 * Generates Python code from ISL specifications including:
 * - Pydantic models
 * - FastAPI/Django/Flask routers
 * - Service layer
 * - Repository pattern
 * - Database models
 * 
 * @example
 * ```typescript
 * const generator = new PythonGenerator({ framework: 'fastapi' });
 * const result = generator.generate(authDomain);
 * 
 * for (const file of result.files) {
 *   console.log(file.path, file.content);
 * }
 * ```
 */
export class PythonGenerator {
  private options: Required<PythonGeneratorOptions>;

  constructor(options: Partial<PythonGeneratorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate code for a domain
   */
  generate(domain: Domain): GenerationResult {
    const files: GeneratedFile[] = [];

    // Generate models
    files.push(this.generateModelsFile(domain));

    // Generate router/views based on framework
    switch (this.options.framework) {
      case 'fastapi':
        files.push(...this.generateFastAPIFiles(domain));
        break;
      case 'django':
        files.push(...this.generateDjangoFiles(domain));
        break;
      case 'flask':
        files.push(...this.generateFlaskFiles(domain));
        break;
    }

    // Generate service layer
    files.push(this.generateServiceFile(domain));

    // Generate repository
    files.push(this.generateRepositoryFile(domain));

    // Generate tests if enabled
    if (this.options.generateTests) {
      files.push(...this.generateTestFiles(domain));
    }

    // Generate database models
    if (this.options.orm !== 'none') {
      files.push(this.generateDatabaseModels(domain));
    }

    // Generate migrations if enabled
    if (this.options.generateMigrations && this.options.orm === 'sqlalchemy') {
      files.push(this.generateMigration(domain));
    }

    return {
      files,
      summary: {
        models: files.filter(f => f.type === 'model').length,
        routers: files.filter(f => f.type === 'router').length,
        services: files.filter(f => f.type === 'service').length,
        tests: files.filter(f => f.type === 'test').length,
      },
    };
  }

  /**
   * Generate for multiple domains
   */
  generateAll(domains: Domain[]): GenerationResult {
    const allFiles: GeneratedFile[] = [];
    let totalModels = 0, totalRouters = 0, totalServices = 0, totalTests = 0;

    for (const domain of domains) {
      const result = this.generate(domain);
      allFiles.push(...result.files);
      totalModels += result.summary.models;
      totalRouters += result.summary.routers;
      totalServices += result.summary.services;
      totalTests += result.summary.tests;
    }

    // Generate main app file
    if (this.options.framework === 'fastapi') {
      allFiles.push({
        path: 'app/main.py',
        content: generateFastAPIMain(domains),
        type: 'config',
      });
    }

    // Generate __init__ files
    allFiles.push(...this.generateInitFiles(domains));

    // Generate requirements.txt
    allFiles.push(this.generateRequirements());

    // Generate pyproject.toml
    allFiles.push(this.generatePyproject());

    return {
      files: allFiles,
      summary: {
        models: totalModels,
        routers: totalRouters,
        services: totalServices,
        tests: totalTests,
      },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateModelsFile(domain: Domain): GeneratedFile {
    const imports = this.generateModelImports();
    const entityModels = (domain.entities ?? [])
      .map(e => generatePydanticModel(e, { strictTyping: this.options.strictTyping }))
      .join('\n\n');
    
    const behaviorModels = domain.behaviors
      .map(b => generateBehaviorModels(b, domain.name))
      .join('\n\n');

    const content = `${imports}

# Entity Models
${entityModels}

# Request/Response Models
${behaviorModels}
`;

    return {
      path: `app/domains/${domain.name.toLowerCase()}/models.py`,
      content,
      type: 'model',
    };
  }

  private generateModelImports(): string {
    return `"""
Pydantic Models

Auto-generated from ISL specification.
"""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator, EmailStr, HttpUrl, AnyUrl
from pydantic.networks import IPv4Address, IPv6Address
`;
  }

  private generateFastAPIFiles(domain: Domain): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const basePath = `app/domains/${domain.name.toLowerCase()}`;

    // Router
    files.push({
      path: `${basePath}/router.py`,
      content: generateFastAPIRouter(domain),
      type: 'router',
    });

    // Dependencies
    files.push({
      path: `${basePath}/dependencies.py`,
      content: generateDependencies(domain),
      type: 'config',
    });

    return files;
  }

  private generateDjangoFiles(domain: Domain): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const basePath = `app/${domain.name.toLowerCase()}`;

    // Views
    files.push({
      path: `${basePath}/views.py`,
      content: this.generateDjangoViews(domain),
      type: 'router',
    });

    // URLs
    files.push({
      path: `${basePath}/urls.py`,
      content: this.generateDjangoUrls(domain),
      type: 'config',
    });

    // Serializers
    files.push({
      path: `${basePath}/serializers.py`,
      content: this.generateDjangoSerializers(domain),
      type: 'model',
    });

    return files;
  }

  private generateFlaskFiles(domain: Domain): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const basePath = `app/${domain.name.toLowerCase()}`;

    // Blueprint
    files.push({
      path: `${basePath}/routes.py`,
      content: this.generateFlaskBlueprint(domain),
      type: 'router',
    });

    return files;
  }

  private generateServiceFile(domain: Domain): GeneratedFile {
    return {
      path: `app/domains/${domain.name.toLowerCase()}/services.py`,
      content: generateService(domain),
      type: 'service',
    };
  }

  private generateRepositoryFile(domain: Domain): GeneratedFile {
    const baseName = this.pascalCase(domain.name);
    const lowerName = domain.name.toLowerCase();

    const content = `"""
${domain.name} Repository

Auto-generated from ISL specification.
"""
from typing import Optional, List
from sqlalchemy.orm import Session

from .database_models import ${baseName}Model


class ${baseName}Repository:
    """Repository for ${domain.name} domain."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def get_by_id(self, id: str) -> Optional[${baseName}Model]:
        """Get entity by ID."""
        return self.db.query(${baseName}Model).filter(${baseName}Model.id == id).first()
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[${baseName}Model]:
        """Get all entities with pagination."""
        return self.db.query(${baseName}Model).offset(skip).limit(limit).all()
    
    async def create(self, data: dict) -> ${baseName}Model:
        """Create new entity."""
        entity = ${baseName}Model(**data)
        self.db.add(entity)
        self.db.commit()
        self.db.refresh(entity)
        return entity
    
    async def update(self, id: str, data: dict) -> Optional[${baseName}Model]:
        """Update entity."""
        entity = await self.get_by_id(id)
        if entity:
            for key, value in data.items():
                setattr(entity, key, value)
            self.db.commit()
            self.db.refresh(entity)
        return entity
    
    async def delete(self, id: str) -> bool:
        """Delete entity."""
        entity = await self.get_by_id(id)
        if entity:
            self.db.delete(entity)
            self.db.commit()
            return True
        return False
`;

    return {
      path: `app/domains/${lowerName}/repositories.py`,
      content,
      type: 'repository',
    };
  }

  private generateDatabaseModels(domain: Domain): GeneratedFile {
    const baseName = this.pascalCase(domain.name);
    const entities = domain.entities ?? [];

    const models = entities.map(entity => {
      const columns = Object.entries(entity.properties)
        .map(([name, prop]) => this.generateSQLAlchemyColumn(name, prop))
        .join('\n    ');

      return `
class ${this.pascalCase(entity.name)}Model(Base):
    """${entity.description ?? entity.name} database model."""
    
    __tablename__ = "${this.snakeCase(entity.name)}s"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    ${columns}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
`;
    }).join('\n');

    const content = `"""
Database Models

Auto-generated from ISL specification.
"""
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base

${models}
`;

    return {
      path: `app/domains/${domain.name.toLowerCase()}/database_models.py`,
      content,
      type: 'model',
    };
  }

  private generateSQLAlchemyColumn(name: string, prop: { type: string; required?: boolean }): string {
    const typeMap: Record<string, string> = {
      string: 'String',
      number: 'Float',
      integer: 'Integer',
      boolean: 'Boolean',
      object: 'JSON',
      array: 'JSON',
      datetime: 'DateTime',
      date: 'String',
      uuid: 'String',
      email: 'String',
    };

    const sqlType = typeMap[prop.type] ?? 'String';
    const nullable = prop.required === false ? ', nullable=True' : '';

    return `${name} = Column(${sqlType}${nullable})`;
  }

  private generateMigration(domain: Domain): GeneratedFile {
    const content = `"""
Migration for ${domain.name}

Auto-generated from ISL specification.
"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    # TODO: Implement upgrade
    pass


def downgrade():
    # TODO: Implement downgrade
    pass
`;

    return {
      path: `migrations/versions/${Date.now()}_${domain.name.toLowerCase()}.py`,
      content,
      type: 'migration',
    };
  }

  private generateTestFiles(domain: Domain): GeneratedFile[] {
    const baseName = this.pascalCase(domain.name);
    const lowerName = domain.name.toLowerCase();

    const testContent = `"""
Tests for ${domain.name}

Auto-generated from ISL specification.
"""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


class Test${baseName}:
    """Tests for ${domain.name} domain."""
    
${domain.behaviors.map(b => this.generateBehaviorTest(domain.name, b)).join('\n\n')}
`;

    return [{
      path: `tests/test_${lowerName}.py`,
      content: testContent,
      type: 'test',
    }];
  }

  private generateBehaviorTest(domainName: string, behavior: Behavior): string {
    const funcName = this.snakeCase(behavior.name);
    const method = this.inferHttpMethod(behavior.name);
    const path = `/${domainName.toLowerCase()}${this.inferPath(behavior.name)}`;

    return `    @pytest.mark.asyncio
    async def test_${funcName}(self, client):
        """Test ${behavior.name} behavior."""
        response = await client.${method}("${path}")
        # TODO: Add assertions based on postconditions
        assert response.status_code in [200, 201]`;
  }

  private generateInitFiles(domains: Domain[]): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    // Root app __init__
    files.push({
      path: 'app/__init__.py',
      content: '"""ISL Generated Application."""\n',
      type: 'config',
    });

    // Domains __init__
    files.push({
      path: 'app/domains/__init__.py',
      content: '"""Domain modules."""\n',
      type: 'config',
    });

    // Per-domain __init__
    for (const domain of domains) {
      files.push({
        path: `app/domains/${domain.name.toLowerCase()}/__init__.py`,
        content: `"""${domain.name} domain."""\nfrom .models import *\nfrom .services import *\n`,
        type: 'config',
      });
    }

    return files;
  }

  private generateRequirements(): GeneratedFile {
    const deps = [
      'fastapi>=0.109.0',
      'uvicorn[standard]>=0.27.0',
      'pydantic>=2.5.0',
      'pydantic-settings>=2.1.0',
      'sqlalchemy>=2.0.0',
      'alembic>=1.13.0',
      'httpx>=0.26.0',
      'python-jose[cryptography]>=3.3.0',
      'passlib[bcrypt]>=1.7.4',
      'python-multipart>=0.0.6',
    ];

    if (this.options.generateTests) {
      deps.push('pytest>=7.4.0', 'pytest-asyncio>=0.23.0', 'pytest-cov>=4.1.0');
    }

    return {
      path: 'requirements.txt',
      content: deps.join('\n') + '\n',
      type: 'config',
    };
  }

  private generatePyproject(): GeneratedFile {
    const content = `[project]
name = "isl-generated-api"
version = "1.0.0"
description = "API generated from ISL specifications"
requires-python = ">=${this.options.pythonVersion}"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py${this.options.pythonVersion.replace('.', '')}"

[tool.mypy]
python_version = "${this.options.pythonVersion}"
strict = true
`;

    return {
      path: 'pyproject.toml',
      content,
      type: 'config',
    };
  }

  // Django/Flask helpers
  private generateDjangoViews(domain: Domain): string {
    return `"""Django views - TODO: Implement"""`;
  }

  private generateDjangoUrls(domain: Domain): string {
    return `"""Django URLs - TODO: Implement"""`;
  }

  private generateDjangoSerializers(domain: Domain): string {
    return `"""Django serializers - TODO: Implement"""`;
  }

  private generateFlaskBlueprint(domain: Domain): string {
    return `"""Flask blueprint - TODO: Implement"""`;
  }

  // Utility methods
  private pascalCase(str: string): string {
    return str.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  private snakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/-/g, '_');
  }

  private inferHttpMethod(name: string): string {
    const lower = name.toLowerCase();
    if (lower.startsWith('get') || lower.startsWith('list') || lower.startsWith('find')) return 'get';
    if (lower.startsWith('create') || lower.startsWith('add')) return 'post';
    if (lower.startsWith('update')) return 'put';
    if (lower.startsWith('delete')) return 'delete';
    return 'post';
  }

  private inferPath(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('byid') || lower.includes('by_id')) return '/{id}';
    if (lower.startsWith('list')) return '/';
    if (lower.startsWith('create')) return '/';
    if (lower.startsWith('update') || lower.startsWith('delete')) return '/{id}';
    return `/${this.snakeCase(name)}`;
  }
}

/**
 * Create a Python generator
 */
export function createPythonGenerator(options?: Partial<PythonGeneratorOptions>): PythonGenerator {
  return new PythonGenerator(options);
}
