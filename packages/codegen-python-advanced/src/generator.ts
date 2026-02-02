// ============================================================================
// Advanced Python Code Generator
// ============================================================================

import type {
  PythonGeneratorOptions,
  PythonTypeInfo,
  GeneratedFile,
  GenerationResult,
} from './types';
import { DEFAULT_OPTIONS, ISL_TO_PYTHON_TYPES } from './types';

/**
 * ISL AST types
 */
interface ISLEntity {
  name: string;
  properties: ISLProperty[];
  behaviors?: ISLBehavior[];
  invariants?: string[];
  description?: string;
}

interface ISLProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  constraints?: string[];
}

interface ISLBehavior {
  name: string;
  preconditions?: string[];
  postconditions?: string[];
  input?: ISLProperty[];
  output?: string;
}

interface ISLDomain {
  name: string;
  entities: ISLEntity[];
  behaviors?: ISLBehavior[];
}

/**
 * Generate Python code from ISL domain
 */
export function generate(
  domain: ISLDomain,
  options: Partial<PythonGeneratorOptions> = {}
): GenerationResult {
  const mergedOptions: PythonGeneratorOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    packageName: options.packageName || snakeCase(domain.name),
  };

  const files: GeneratedFile[] = [];
  const requirements: string[] = [];
  const warnings: string[] = [];
  const statistics = {
    models: 0,
    schemas: 0,
    routers: 0,
    services: 0,
    tests: 0,
    totalLines: 0,
  };

  // Add base requirements
  addRequirements(requirements, mergedOptions);

  // Generate package __init__.py
  files.push({
    path: `${mergedOptions.packageName}/__init__.py`,
    content: generatePackageInit(domain, mergedOptions),
    type: 'config',
  });

  // Generate models
  for (const entity of domain.entities) {
    // SQLAlchemy model
    if (mergedOptions.orm === 'sqlalchemy') {
      const modelContent = generateSQLAlchemyModel(entity, mergedOptions);
      files.push({
        path: `${mergedOptions.packageName}/models/${snakeCase(entity.name)}.py`,
        content: modelContent,
        type: 'model',
      });
      statistics.models++;
      statistics.totalLines += modelContent.split('\n').length;
    }

    // Pydantic schema
    const schemaContent = generatePydanticSchema(entity, mergedOptions);
    files.push({
      path: `${mergedOptions.packageName}/schemas/${snakeCase(entity.name)}.py`,
      content: schemaContent,
      type: 'schema',
    });
    statistics.schemas++;
    statistics.totalLines += schemaContent.split('\n').length;

    // Service
    const serviceContent = generateService(entity, mergedOptions);
    files.push({
      path: `${mergedOptions.packageName}/services/${snakeCase(entity.name)}_service.py`,
      content: serviceContent,
      type: 'service',
    });
    statistics.services++;
    statistics.totalLines += serviceContent.split('\n').length;

    // Router (FastAPI)
    if (mergedOptions.framework === 'fastapi') {
      const routerContent = generateFastAPIRouter(entity, mergedOptions);
      files.push({
        path: `${mergedOptions.packageName}/routers/${snakeCase(entity.name)}.py`,
        content: routerContent,
        type: 'router',
      });
      statistics.routers++;
      statistics.totalLines += routerContent.split('\n').length;
    }

    // Tests
    if (mergedOptions.generateTests) {
      const testContent = generateTests(entity, mergedOptions);
      files.push({
        path: `tests/test_${snakeCase(entity.name)}.py`,
        content: testContent,
        type: 'test',
      });
      statistics.tests++;
      statistics.totalLines += testContent.split('\n').length;
    }
  }

  // Generate models __init__.py
  files.push({
    path: `${mergedOptions.packageName}/models/__init__.py`,
    content: generateModelsInit(domain.entities, mergedOptions),
    type: 'config',
  });

  // Generate schemas __init__.py
  files.push({
    path: `${mergedOptions.packageName}/schemas/__init__.py`,
    content: generateSchemasInit(domain.entities, mergedOptions),
    type: 'config',
  });

  // Generate services __init__.py
  files.push({
    path: `${mergedOptions.packageName}/services/__init__.py`,
    content: generateServicesInit(domain.entities, mergedOptions),
    type: 'config',
  });

  // Generate main app file
  if (mergedOptions.framework === 'fastapi') {
    const mainContent = generateFastAPIMain(domain, mergedOptions);
    files.push({
      path: `${mergedOptions.packageName}/main.py`,
      content: mainContent,
      type: 'config',
    });
    statistics.totalLines += mainContent.split('\n').length;
  }

  // Generate database config
  if (mergedOptions.orm === 'sqlalchemy') {
    const dbContent = generateDatabaseConfig(mergedOptions);
    files.push({
      path: `${mergedOptions.packageName}/database.py`,
      content: dbContent,
      type: 'config',
    });
    statistics.totalLines += dbContent.split('\n').length;
  }

  // Generate requirements.txt
  files.push({
    path: 'requirements.txt',
    content: requirements.join('\n'),
    type: 'config',
  });

  // Generate pyproject.toml
  files.push({
    path: 'pyproject.toml',
    content: generatePyProjectToml(mergedOptions),
    type: 'config',
  });

  return {
    files,
    requirements,
    warnings,
    statistics,
  };
}

/**
 * Add requirements based on options
 */
function addRequirements(requirements: string[], options: PythonGeneratorOptions): void {
  // Core
  requirements.push('pydantic>=2.5.0');
  requirements.push('pydantic-settings>=2.1.0');
  
  // Framework
  if (options.framework === 'fastapi') {
    requirements.push('fastapi>=0.109.0');
    requirements.push('uvicorn[standard]>=0.27.0');
    requirements.push('python-multipart>=0.0.6');
  } else if (options.framework === 'django') {
    requirements.push('django>=5.0');
    requirements.push('djangorestframework>=3.14.0');
  } else if (options.framework === 'flask') {
    requirements.push('flask>=3.0.0');
    requirements.push('flask-restx>=1.3.0');
  }

  // ORM
  if (options.orm === 'sqlalchemy') {
    requirements.push('sqlalchemy>=2.0.0');
    requirements.push('alembic>=1.13.0');
    requirements.push('asyncpg>=0.29.0');  // PostgreSQL async driver
  } else if (options.orm === 'tortoise') {
    requirements.push('tortoise-orm>=0.20.0');
  }

  // Testing
  if (options.generateTests) {
    requirements.push('pytest>=8.0.0');
    requirements.push('pytest-asyncio>=0.23.0');
    requirements.push('httpx>=0.26.0');
    requirements.push('factory-boy>=3.3.0');
  }

  // Additional
  requirements.push('python-dotenv>=1.0.0');
  requirements.push('email-validator>=2.1.0');
}

/**
 * Generate SQLAlchemy model
 */
function generateSQLAlchemyModel(entity: ISLEntity, options: PythonGeneratorOptions): string {
  const className = pascalCase(entity.name);
  const tableName = snakeCase(entity.name) + 's';
  
  const imports = [
    'from datetime import datetime',
    'from uuid import UUID, uuid4',
    'from typing import Optional',
    'from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Text, ForeignKey',
    'from sqlalchemy.dialects.postgresql import UUID as PGUUID',
    'from sqlalchemy.orm import relationship, Mapped, mapped_column',
    `from ${options.packageName}.database import Base`,
  ];

  const lines: string[] = [];
  lines.push(imports.join('\n'));
  lines.push('');
  lines.push('');

  // Class docstring
  if (options.docstrings && entity.description) {
    lines.push(`class ${className}(Base):`);
    lines.push(`    """${entity.description}"""`);
  } else {
    lines.push(`class ${className}(Base):`);
  }

  lines.push(`    __tablename__ = "${tableName}"`);
  lines.push('');

  // ID field
  lines.push('    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)');
  
  // Entity fields
  for (const prop of entity.properties) {
    const fieldDef = generateSQLAlchemyField(prop, options);
    lines.push(`    ${fieldDef}`);
  }

  // Timestamps
  lines.push('    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)');
  lines.push('    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)');
  lines.push('');

  // Repr method
  lines.push('    def __repr__(self) -> str:');
  lines.push(`        return f"<${className}(id={self.id})>"`);

  return lines.join('\n');
}

/**
 * Generate SQLAlchemy field definition
 */
function generateSQLAlchemyField(prop: ISLProperty, options: PythonGeneratorOptions): string {
  const fieldName = snakeCase(prop.name);
  const pythonType = convertToPythonType(prop.type, options);
  const sqlType = convertToSQLAlchemyType(prop.type);
  const nullable = !prop.required;

  let mapped = `Mapped[${pythonType.name}]`;
  if (nullable) {
    mapped = `Mapped[Optional[${pythonType.name}]]`;
  }

  let definition = `${fieldName}: ${mapped} = mapped_column(${sqlType}`;
  if (nullable) {
    definition += ', nullable=True';
  }
  definition += ')';

  return definition;
}

/**
 * Generate Pydantic schema
 */
function generatePydanticSchema(entity: ISLEntity, options: PythonGeneratorOptions): string {
  const className = pascalCase(entity.name);
  
  const imports = [
    'from datetime import datetime',
    'from uuid import UUID',
    'from typing import Optional, List',
    'from pydantic import BaseModel, Field, EmailStr, HttpUrl, ConfigDict',
  ];

  const lines: string[] = [];
  lines.push(imports.join('\n'));
  lines.push('');
  lines.push('');

  // Base schema
  lines.push(`class ${className}Base(BaseModel):`);
  if (options.docstrings && entity.description) {
    lines.push(`    """${entity.description}"""`);
    lines.push('');
  }
  
  if (options.strictMode) {
    lines.push('    model_config = ConfigDict(strict=True, from_attributes=True)');
    lines.push('');
  }

  for (const prop of entity.properties) {
    const fieldDef = generatePydanticField(prop, options);
    lines.push(`    ${fieldDef}`);
  }

  lines.push('');
  lines.push('');

  // Create schema
  lines.push(`class ${className}Create(${className}Base):`);
  lines.push('    """Schema for creating a new entity"""');
  lines.push('    pass');
  lines.push('');
  lines.push('');

  // Update schema
  lines.push(`class ${className}Update(BaseModel):`);
  lines.push('    """Schema for updating an entity"""');
  if (options.strictMode) {
    lines.push('    model_config = ConfigDict(strict=True)');
    lines.push('');
  }
  
  for (const prop of entity.properties) {
    const fieldDef = generatePydanticField({ ...prop, required: false }, options);
    lines.push(`    ${fieldDef}`);
  }

  lines.push('');
  lines.push('');

  // Response schema
  lines.push(`class ${className}Response(${className}Base):`);
  lines.push('    """Schema for API responses"""');
  lines.push('    id: UUID');
  lines.push('    created_at: datetime');
  lines.push('    updated_at: Optional[datetime] = None');
  lines.push('');
  lines.push('    model_config = ConfigDict(from_attributes=True)');

  return lines.join('\n');
}

/**
 * Generate Pydantic field definition
 */
function generatePydanticField(prop: ISLProperty, options: PythonGeneratorOptions): string {
  const fieldName = snakeCase(prop.name);
  const pythonType = convertToPythonType(prop.type, options);
  
  let typeName = pythonType.name;
  if (!prop.required) {
    typeName = `Optional[${typeName}]`;
  }

  let fieldDef = `${fieldName}: ${typeName}`;

  // Add Field with description
  const fieldArgs: string[] = [];
  if (!prop.required) {
    fieldArgs.push('default=None');
  }
  if (prop.description) {
    fieldArgs.push(`description="${prop.description}"`);
  }

  // Add constraints
  if (prop.constraints) {
    for (const constraint of prop.constraints) {
      if (constraint.startsWith('min:')) {
        fieldArgs.push(`ge=${constraint.split(':')[1]}`);
      } else if (constraint.startsWith('max:')) {
        fieldArgs.push(`le=${constraint.split(':')[1]}`);
      } else if (constraint.startsWith('minLength:')) {
        fieldArgs.push(`min_length=${constraint.split(':')[1]}`);
      } else if (constraint.startsWith('maxLength:')) {
        fieldArgs.push(`max_length=${constraint.split(':')[1]}`);
      } else if (constraint.startsWith('pattern:')) {
        fieldArgs.push(`pattern="${constraint.split(':')[1]}"`);
      }
    }
  }

  if (fieldArgs.length > 0) {
    fieldDef += ` = Field(${fieldArgs.join(', ')})`;
  } else if (!prop.required) {
    fieldDef += ' = None';
  }

  return fieldDef;
}

/**
 * Generate FastAPI router
 */
function generateFastAPIRouter(entity: ISLEntity, options: PythonGeneratorOptions): string {
  const className = pascalCase(entity.name);
  const routerName = snakeCase(entity.name);
  const serviceName = `${className}Service`;

  const lines: string[] = [];
  
  // Imports
  lines.push('from uuid import UUID');
  lines.push('from typing import List');
  lines.push('from fastapi import APIRouter, Depends, HTTPException, status');
  lines.push('from sqlalchemy.ext.asyncio import AsyncSession');
  lines.push('');
  lines.push(`from ${options.packageName}.database import get_db`);
  lines.push(`from ${options.packageName}.schemas.${routerName} import ${className}Create, ${className}Update, ${className}Response`);
  lines.push(`from ${options.packageName}.services.${routerName}_service import ${serviceName}`);
  lines.push('');
  lines.push('');
  lines.push(`router = APIRouter(prefix="/${routerName}s", tags=["${className}s"])`);
  lines.push('');
  lines.push('');

  // Get all
  lines.push(`@router.get("/", response_model=List[${className}Response])`);
  lines.push(`async def get_all_${routerName}s(`);
  lines.push('    skip: int = 0,');
  lines.push('    limit: int = 100,');
  lines.push('    db: AsyncSession = Depends(get_db)');
  lines.push(`) -> List[${className}Response]:`);
  lines.push(`    """Get all ${className} entities"""`);
  lines.push(`    service = ${serviceName}(db)`);
  lines.push('    return await service.get_all(skip=skip, limit=limit)');
  lines.push('');
  lines.push('');

  // Get by ID
  lines.push(`@router.get("/{id}", response_model=${className}Response)`);
  lines.push(`async def get_${routerName}(`);
  lines.push('    id: UUID,');
  lines.push('    db: AsyncSession = Depends(get_db)');
  lines.push(`) -> ${className}Response:`);
  lines.push(`    """Get a ${className} by ID"""`);
  lines.push(`    service = ${serviceName}(db)`);
  lines.push('    result = await service.get_by_id(id)');
  lines.push('    if not result:');
  lines.push(`        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`);
  lines.push('    return result');
  lines.push('');
  lines.push('');

  // Create
  lines.push(`@router.post("/", response_model=${className}Response, status_code=status.HTTP_201_CREATED)`);
  lines.push(`async def create_${routerName}(`);
  lines.push(`    data: ${className}Create,`);
  lines.push('    db: AsyncSession = Depends(get_db)');
  lines.push(`) -> ${className}Response:`);
  lines.push(`    """Create a new ${className}"""`);
  lines.push(`    service = ${serviceName}(db)`);
  lines.push('    return await service.create(data)');
  lines.push('');
  lines.push('');

  // Update
  lines.push(`@router.patch("/{id}", response_model=${className}Response)`);
  lines.push(`async def update_${routerName}(`);
  lines.push('    id: UUID,');
  lines.push(`    data: ${className}Update,`);
  lines.push('    db: AsyncSession = Depends(get_db)');
  lines.push(`) -> ${className}Response:`);
  lines.push(`    """Update a ${className}"""`);
  lines.push(`    service = ${serviceName}(db)`);
  lines.push('    result = await service.update(id, data)');
  lines.push('    if not result:');
  lines.push(`        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`);
  lines.push('    return result');
  lines.push('');
  lines.push('');

  // Delete
  lines.push(`@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)`);
  lines.push(`async def delete_${routerName}(`);
  lines.push('    id: UUID,');
  lines.push('    db: AsyncSession = Depends(get_db)');
  lines.push(') -> None:');
  lines.push(`    """Delete a ${className}"""`);
  lines.push(`    service = ${serviceName}(db)`);
  lines.push('    success = await service.delete(id)');
  lines.push('    if not success:');
  lines.push(`        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="${className} not found")`);

  return lines.join('\n');
}

/**
 * Generate service class
 */
function generateService(entity: ISLEntity, options: PythonGeneratorOptions): string {
  const className = pascalCase(entity.name);
  const modelName = snakeCase(entity.name);
  const serviceName = `${className}Service`;

  const lines: string[] = [];

  // Imports
  lines.push('from uuid import UUID');
  lines.push('from typing import List, Optional');
  lines.push('from sqlalchemy import select');
  lines.push('from sqlalchemy.ext.asyncio import AsyncSession');
  lines.push('');
  lines.push(`from ${options.packageName}.models.${modelName} import ${className}`);
  lines.push(`from ${options.packageName}.schemas.${modelName} import ${className}Create, ${className}Update`);
  lines.push('');
  lines.push('');

  // Class
  lines.push(`class ${serviceName}:`);
  lines.push(`    """Service layer for ${className} operations"""`);
  lines.push('');
  lines.push('    def __init__(self, db: AsyncSession):');
  lines.push('        self.db = db');
  lines.push('');

  // Get all
  lines.push(`    async def get_all(self, skip: int = 0, limit: int = 100) -> List[${className}]:`);
  lines.push(`        """Get all ${className} entities with pagination"""`);
  lines.push(`        query = select(${className}).offset(skip).limit(limit)`);
  lines.push('        result = await self.db.execute(query)');
  lines.push('        return list(result.scalars().all())');
  lines.push('');

  // Get by ID
  lines.push(`    async def get_by_id(self, id: UUID) -> Optional[${className}]:`);
  lines.push(`        """Get a ${className} by ID"""`);
  lines.push(`        query = select(${className}).where(${className}.id == id)`);
  lines.push('        result = await self.db.execute(query)');
  lines.push('        return result.scalar_one_or_none()');
  lines.push('');

  // Create
  lines.push(`    async def create(self, data: ${className}Create) -> ${className}:`);
  lines.push(`        """Create a new ${className}"""`);
  lines.push(`        entity = ${className}(**data.model_dump())`);
  lines.push('        self.db.add(entity)');
  lines.push('        await self.db.commit()');
  lines.push('        await self.db.refresh(entity)');
  lines.push('        return entity');
  lines.push('');

  // Update
  lines.push(`    async def update(self, id: UUID, data: ${className}Update) -> Optional[${className}]:`);
  lines.push(`        """Update a ${className}"""`);
  lines.push('        entity = await self.get_by_id(id)');
  lines.push('        if not entity:');
  lines.push('            return None');
  lines.push('        ');
  lines.push('        update_data = data.model_dump(exclude_unset=True)');
  lines.push('        for field, value in update_data.items():');
  lines.push('            setattr(entity, field, value)');
  lines.push('        ');
  lines.push('        await self.db.commit()');
  lines.push('        await self.db.refresh(entity)');
  lines.push('        return entity');
  lines.push('');

  // Delete
  lines.push('    async def delete(self, id: UUID) -> bool:');
  lines.push(`        """Delete a ${className}"""`);
  lines.push('        entity = await self.get_by_id(id)');
  lines.push('        if not entity:');
  lines.push('            return False');
  lines.push('        ');
  lines.push('        await self.db.delete(entity)');
  lines.push('        await self.db.commit()');
  lines.push('        return True');

  return lines.join('\n');
}

/**
 * Generate tests
 */
function generateTests(entity: ISLEntity, options: PythonGeneratorOptions): string {
  const className = pascalCase(entity.name);
  const routerName = snakeCase(entity.name);

  const lines: string[] = [];

  lines.push('import pytest');
  lines.push('from uuid import uuid4');
  lines.push('from httpx import AsyncClient');
  lines.push('');
  lines.push(`from ${options.packageName}.main import app`);
  lines.push('');
  lines.push('');
  lines.push('@pytest.fixture');
  lines.push('async def client():');
  lines.push('    async with AsyncClient(app=app, base_url="http://test") as ac:');
  lines.push('        yield ac');
  lines.push('');
  lines.push('');
  lines.push(`class Test${className}Router:`);
  lines.push(`    """Tests for ${className} API endpoints"""`);
  lines.push('');
  
  // Test create
  lines.push('    @pytest.mark.asyncio');
  lines.push(`    async def test_create_${routerName}(self, client: AsyncClient):`);
  lines.push(`        """Test creating a new ${className}"""`);
  lines.push('        data = {');
  for (const prop of entity.properties.slice(0, 3)) {
    const value = getTestValue(prop.type);
    lines.push(`            "${snakeCase(prop.name)}": ${value},`);
  }
  lines.push('        }');
  lines.push(`        response = await client.post("/${routerName}s/", json=data)`);
  lines.push('        assert response.status_code == 201');
  lines.push('        result = response.json()');
  lines.push('        assert "id" in result');
  lines.push('');

  // Test get all
  lines.push('    @pytest.mark.asyncio');
  lines.push(`    async def test_get_all_${routerName}s(self, client: AsyncClient):`);
  lines.push(`        """Test getting all ${className} entities"""`);
  lines.push(`        response = await client.get("/${routerName}s/")`);
  lines.push('        assert response.status_code == 200');
  lines.push('        assert isinstance(response.json(), list)');
  lines.push('');

  // Test get by ID
  lines.push('    @pytest.mark.asyncio');
  lines.push(`    async def test_get_${routerName}_not_found(self, client: AsyncClient):`);
  lines.push(`        """Test getting a non-existent ${className}"""`);
  lines.push('        fake_id = str(uuid4())');
  lines.push(`        response = await client.get(f"/${routerName}s/{fake_id}")`);
  lines.push('        assert response.status_code == 404');

  return lines.join('\n');
}

/**
 * Get test value for a type
 */
function getTestValue(type: string): string {
  const typeMap: Record<string, string> = {
    'String': '"test_value"',
    'Int': '42',
    'Float': '3.14',
    'Boolean': 'True',
    'Email': '"test@example.com"',
    'URL': '"https://example.com"',
    'UUID': 'str(uuid4())',
  };
  return typeMap[type] || '"test"';
}

/**
 * Generate FastAPI main.py
 */
function generateFastAPIMain(domain: ISLDomain, options: PythonGeneratorOptions): string {
  const lines: string[] = [];

  lines.push('from contextlib import asynccontextmanager');
  lines.push('from fastapi import FastAPI');
  lines.push('from fastapi.middleware.cors import CORSMiddleware');
  lines.push('');
  lines.push(`from ${options.packageName}.database import engine, Base`);

  // Import routers
  for (const entity of domain.entities) {
    const routerName = snakeCase(entity.name);
    lines.push(`from ${options.packageName}.routers.${routerName} import router as ${routerName}_router`);
  }

  lines.push('');
  lines.push('');
  lines.push('@asynccontextmanager');
  lines.push('async def lifespan(app: FastAPI):');
  lines.push('    # Startup');
  lines.push('    async with engine.begin() as conn:');
  lines.push('        await conn.run_sync(Base.metadata.create_all)');
  lines.push('    yield');
  lines.push('    # Shutdown');
  lines.push('    await engine.dispose()');
  lines.push('');
  lines.push('');
  lines.push('app = FastAPI(');
  lines.push(`    title="${pascalCase(domain.name)} API",`);
  lines.push('    description="Generated from ISL specification",');
  lines.push('    version="0.1.0",');
  lines.push('    lifespan=lifespan,');
  lines.push(')');
  lines.push('');
  lines.push('');
  lines.push('# CORS middleware');
  lines.push('app.add_middleware(');
  lines.push('    CORSMiddleware,');
  lines.push('    allow_origins=["*"],');
  lines.push('    allow_credentials=True,');
  lines.push('    allow_methods=["*"],');
  lines.push('    allow_headers=["*"],');
  lines.push(')');
  lines.push('');
  lines.push('');
  lines.push('# Include routers');

  for (const entity of domain.entities) {
    const routerName = snakeCase(entity.name);
    lines.push(`app.include_router(${routerName}_router)`);
  }

  lines.push('');
  lines.push('');
  lines.push('@app.get("/health")');
  lines.push('async def health_check():');
  lines.push('    return {"status": "healthy"}');

  return lines.join('\n');
}

/**
 * Generate database config
 */
function generateDatabaseConfig(options: PythonGeneratorOptions): string {
  return `from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/${options.packageName}"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting database sessions"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
`;
}

/**
 * Generate package __init__.py
 */
function generatePackageInit(domain: ISLDomain, _options: PythonGeneratorOptions): string {
  return `"""${pascalCase(domain.name)} - Generated from ISL specification"""

__version__ = "0.1.0"
`;
}

/**
 * Generate models __init__.py
 */
function generateModelsInit(entities: ISLEntity[], options: PythonGeneratorOptions): string {
  const imports = entities.map(e => {
    const className = pascalCase(e.name);
    const moduleName = snakeCase(e.name);
    return `from ${options.packageName}.models.${moduleName} import ${className}`;
  });
  
  const exports = entities.map(e => `"${pascalCase(e.name)}"`);

  return `${imports.join('\n')}

__all__ = [${exports.join(', ')}]
`;
}

/**
 * Generate schemas __init__.py
 */
function generateSchemasInit(entities: ISLEntity[], options: PythonGeneratorOptions): string {
  const imports: string[] = [];
  const exports: string[] = [];

  for (const e of entities) {
    const className = pascalCase(e.name);
    const moduleName = snakeCase(e.name);
    imports.push(`from ${options.packageName}.schemas.${moduleName} import ${className}Base, ${className}Create, ${className}Update, ${className}Response`);
    exports.push(`"${className}Base"`, `"${className}Create"`, `"${className}Update"`, `"${className}Response"`);
  }

  return `${imports.join('\n')}

__all__ = [${exports.join(', ')}]
`;
}

/**
 * Generate services __init__.py
 */
function generateServicesInit(entities: ISLEntity[], options: PythonGeneratorOptions): string {
  const imports = entities.map(e => {
    const className = pascalCase(e.name);
    const moduleName = snakeCase(e.name);
    return `from ${options.packageName}.services.${moduleName}_service import ${className}Service`;
  });
  
  const exports = entities.map(e => `"${pascalCase(e.name)}Service"`);

  return `${imports.join('\n')}

__all__ = [${exports.join(', ')}]
`;
}

/**
 * Generate pyproject.toml
 */
function generatePyProjectToml(options: PythonGeneratorOptions): string {
  return `[tool.poetry]
name = "${options.packageName}"
version = "0.1.0"
description = "Generated from ISL specification"
authors = ["ISL Generator"]

[tool.poetry.dependencies]
python = "^${options.pythonVersion}"

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
target-version = "py${options.pythonVersion.replace('.', '')}"
line-length = 100

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
`;
}

// Utility functions
function pascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function convertToPythonType(islType: string, options: PythonGeneratorOptions): PythonTypeInfo {
  if (options.typeMappings && options.typeMappings[islType]) {
    return { name: options.typeMappings[islType], isOptional: false, isList: false, isDict: false };
  }

  if (islType.endsWith('[]')) {
    const inner = convertToPythonType(islType.slice(0, -2), options);
    return { name: `List[${inner.name}]`, isOptional: false, isList: true, isDict: false, genericArgs: [inner] };
  }

  if (islType.endsWith('?')) {
    const inner = convertToPythonType(islType.slice(0, -1), options);
    return { ...inner, isOptional: true };
  }

  const pythonType = ISL_TO_PYTHON_TYPES[islType] || islType;
  return { name: pythonType, isOptional: false, isList: false, isDict: false };
}

function convertToSQLAlchemyType(islType: string): string {
  const typeMap: Record<string, string> = {
    'String': 'String(255)',
    'Int': 'Integer',
    'Float': 'Float',
    'Boolean': 'Boolean',
    'DateTime': 'DateTime',
    'Date': 'Date',
    'Time': 'Time',
    'UUID': 'PGUUID(as_uuid=True)',
    'Decimal': 'Numeric(10, 2)',
    'Money': 'Numeric(10, 2)',
    'Email': 'String(255)',
    'URL': 'String(500)',
    'Phone': 'String(50)',
    'JSON': 'JSON',
    'Binary': 'LargeBinary',
    'Text': 'Text',
  };
  return typeMap[islType] || 'String(255)';
}

export { generate as generatePython };
