// ============================================================================
// FastAPI Templates
// ============================================================================

import type { Domain, Behavior, Entity } from '../types.js';

/**
 * Generate FastAPI router
 */
export function generateFastAPIRouter(domain: Domain): string {
  const endpoints = domain.behaviors.map(b => generateEndpoint(domain.name, b)).join('\n\n');
  const imports = generateRouterImports(domain);

  return `${imports}

router = APIRouter(
    prefix="/${domain.name.toLowerCase()}",
    tags=["${domain.name}"],
    responses={404: {"description": "Not found"}},
)

${endpoints}
`;
}

/**
 * Generate router imports
 */
function generateRouterImports(domain: Domain): string {
  const modelImports = domain.behaviors
    .flatMap(b => {
      const imports: string[] = [];
      if (b.input) imports.push(`${pascalCase(b.name)}Request`);
      if (b.output) imports.push(`${pascalCase(b.name)}Response`);
      return imports;
    })
    .join(', ');

  return `"""
${domain.name} Router

Auto-generated from ISL specification.
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body
from fastapi.responses import JSONResponse

from .models import ${modelImports}
from .services import ${domain.name}Service
from .dependencies import get_${domain.name.toLowerCase()}_service, get_current_user
`;
}

/**
 * Generate endpoint from behavior
 */
function generateEndpoint(domainName: string, behavior: Behavior): string {
  const method = inferHttpMethod(behavior.name);
  const path = inferPath(behavior.name);
  const funcName = snakeCase(behavior.name);
  const baseName = pascalCase(behavior.name);
  
  const hasInput = behavior.input && Object.keys(behavior.input).length > 0;
  const hasOutput = behavior.output && Object.keys(behavior.output).length > 0;

  // Build parameters
  const params: string[] = [];
  params.push(`service: Annotated[${domainName}Service, Depends(get_${domainName.toLowerCase()}_service)]`);
  
  if (hasInput) {
    if (method === 'get') {
      // Use query params for GET
      params.push(`request: Annotated[${baseName}Request, Query()]`);
    } else {
      params.push(`request: ${baseName}Request`);
    }
  }

  // Add path parameters if needed
  if (path.includes('{')) {
    const pathParams = path.match(/\{(\w+)\}/g) || [];
    for (const param of pathParams) {
      const paramName = param.slice(1, -1);
      params.push(`${paramName}: Annotated[str, Path(description="${paramName}")]`);
    }
  }

  const responseModel = hasOutput ? `${baseName}Response` : 'dict';
  const docstring = generateDocstring(behavior);
  const preconditionChecks = generatePreconditionChecks(behavior);
  const postconditionChecks = generatePostconditionChecks(behavior);
  const errorHandlers = generateErrorHandlers(behavior);

  return `
@router.${method}(
    "${path}",
    response_model=${responseModel},
    summary="${behavior.description ?? behavior.name}",
    responses={
        ${behavior.errors?.map(e => `${e.status ?? 400}: {"description": "${e.message ?? e.name}"}`).join(',\n        ') ?? ''}
    }
)
async def ${funcName}(
    ${params.join(',\n    ')}
) -> ${responseModel}:
${docstring}
${preconditionChecks}
    try:
        result = await service.${funcName}(${hasInput ? 'request' : ''})
${postconditionChecks}
        return result
${errorHandlers}
`;
}

/**
 * Generate docstring
 */
function generateDocstring(behavior: Behavior): string {
  const lines: string[] = [`    """${behavior.description ?? behavior.name}`];
  
  if (behavior.preconditions?.length) {
    lines.push('');
    lines.push('    Preconditions:');
    for (const pre of behavior.preconditions) {
      lines.push(`        - ${pre}`);
    }
  }

  if (behavior.postconditions?.length) {
    lines.push('');
    lines.push('    Postconditions:');
    for (const post of behavior.postconditions) {
      lines.push(`        - ${post}`);
    }
  }

  if (behavior.errors?.length) {
    lines.push('');
    lines.push('    Raises:');
    for (const error of behavior.errors) {
      lines.push(`        HTTPException: ${error.name} - ${error.message ?? ''}`);
    }
  }

  lines.push('    """');
  return lines.join('\n');
}

/**
 * Generate precondition checks
 */
function generatePreconditionChecks(behavior: Behavior): string {
  if (!behavior.preconditions?.length) return '';

  const checks = behavior.preconditions.map(pre => {
    // Convert ISL precondition to Python check
    const pythonCheck = convertToPythonCondition(pre);
    return `
    # Precondition: ${pre}
    if not (${pythonCheck}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Precondition failed: ${pre}"
        )`;
  });

  return checks.join('\n');
}

/**
 * Generate postcondition checks
 */
function generatePostconditionChecks(behavior: Behavior): string {
  if (!behavior.postconditions?.length) return '';

  const checks = behavior.postconditions.map(post => {
    const pythonCheck = convertToPythonCondition(post, 'result');
    return `
        # Postcondition: ${post}
        assert ${pythonCheck}, f"Postcondition failed: ${post}"`;
  });

  return checks.join('\n');
}

/**
 * Generate error handlers
 */
function generateErrorHandlers(behavior: Behavior): string {
  if (!behavior.errors?.length) {
    return `    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )`;
  }

  const handlers = behavior.errors.map(error => `
    except ${pascalCase(error.name)}Error as e:
        raise HTTPException(
            status_code=status.HTTP_${error.status ?? 400}_${statusText(error.status ?? 400)},
            detail=e.message
        )`);

  handlers.push(`
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )`);

  return handlers.join('');
}

/**
 * Convert ISL condition to Python
 */
function convertToPythonCondition(condition: string, prefix = 'request'): string {
  return condition
    .replace(/input\./g, `${prefix}.`)
    .replace(/result\./g, 'result.')
    .replace(/!=/g, ' != ')
    .replace(/==/g, ' == ')
    .replace(/\bnull\b/g, 'None')
    .replace(/\btrue\b/gi, 'True')
    .replace(/\bfalse\b/gi, 'False')
    .replace(/\.length/g, ').__len__(')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/!/g, 'not ');
}

/**
 * Infer HTTP method from behavior name
 */
function inferHttpMethod(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith('get') || lowerName.startsWith('list') || lowerName.startsWith('find')) return 'get';
  if (lowerName.startsWith('create') || lowerName.startsWith('add') || lowerName.startsWith('register')) return 'post';
  if (lowerName.startsWith('update') || lowerName.startsWith('modify')) return 'put';
  if (lowerName.startsWith('patch')) return 'patch';
  if (lowerName.startsWith('delete') || lowerName.startsWith('remove')) return 'delete';
  return 'post';
}

/**
 * Infer path from behavior name
 */
function inferPath(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Pattern matching for common CRUD operations
  if (lowerName.startsWith('get') || lowerName.startsWith('find')) {
    const resource = lowerName.replace(/^(get|find)_?/i, '');
    if (resource.endsWith('byid') || resource.includes('by_id')) {
      return `/{id}`;
    }
    return `/${resource || ''}`;
  }
  
  if (lowerName.startsWith('list')) {
    return '/';
  }
  
  if (lowerName.startsWith('create') || lowerName.startsWith('add')) {
    return '/';
  }
  
  if (lowerName.startsWith('update')) {
    return '/{id}';
  }
  
  if (lowerName.startsWith('delete') || lowerName.startsWith('remove')) {
    return '/{id}';
  }

  return `/${snakeCase(name)}`;
}

/**
 * Get status text
 */
function statusText(status: number): string {
  const texts: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return texts[status] ?? 'BAD_REQUEST';
}

/**
 * Convert to snake_case
 */
function snakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/-/g, '_');
}

/**
 * Convert to PascalCase
 */
function pascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Generate FastAPI app main file
 */
export function generateFastAPIMain(domains: Domain[]): string {
  const routerImports = domains
    .map(d => `from .routers.${d.name.toLowerCase()} import router as ${d.name.toLowerCase()}_router`)
    .join('\n');

  const routerIncludes = domains
    .map(d => `app.include_router(${d.name.toLowerCase()}_router)`)
    .join('\n');

  return `"""
FastAPI Application

Auto-generated from ISL specifications.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

${routerImports}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="ISL Generated API",
    description="API generated from Intent Specification Language",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
${routerIncludes}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
`;
}

/**
 * Generate service class
 */
export function generateService(domain: Domain): string {
  const methods = domain.behaviors.map(b => generateServiceMethod(b)).join('\n\n');
  const baseName = pascalCase(domain.name);

  return `"""
${domain.name} Service

Auto-generated from ISL specification.
"""
from typing import Optional
from .models import *
from .repositories import ${baseName}Repository


class ${baseName}Service:
    """Service layer for ${domain.name} domain."""
    
    def __init__(self, repository: ${baseName}Repository):
        self.repository = repository
    
${methods}
`;
}

/**
 * Generate service method
 */
function generateServiceMethod(behavior: Behavior): string {
  const funcName = snakeCase(behavior.name);
  const baseName = pascalCase(behavior.name);
  const hasInput = behavior.input && Object.keys(behavior.input).length > 0;
  const hasOutput = behavior.output && Object.keys(behavior.output).length > 0;

  const inputParam = hasInput ? `request: ${baseName}Request` : '';
  const returnType = hasOutput ? `${baseName}Response` : 'dict';

  return `    async def ${funcName}(self${hasInput ? ', ' + inputParam : ''}) -> ${returnType}:
        """
        ${behavior.description ?? behavior.name}
        """
        # TODO: Implement business logic
        raise NotImplementedError("${funcName} not implemented")`;
}

/**
 * Generate dependencies file
 */
export function generateDependencies(domain: Domain): string {
  const baseName = pascalCase(domain.name);
  const lowerName = domain.name.toLowerCase();

  return `"""
Dependency Injection

Auto-generated from ISL specification.
"""
from typing import Annotated, Generator
from fastapi import Depends
from sqlalchemy.orm import Session

from .database import get_db
from .repositories import ${baseName}Repository
from .services import ${baseName}Service


def get_${lowerName}_repository(
    db: Annotated[Session, Depends(get_db)]
) -> ${baseName}Repository:
    """Get ${domain.name} repository instance."""
    return ${baseName}Repository(db)


def get_${lowerName}_service(
    repository: Annotated[${baseName}Repository, Depends(get_${lowerName}_repository)]
) -> ${baseName}Service:
    """Get ${domain.name} service instance."""
    return ${baseName}Service(repository)


async def get_current_user():
    """Get current authenticated user."""
    # TODO: Implement authentication
    return {"id": "anonymous"}
`;
}
