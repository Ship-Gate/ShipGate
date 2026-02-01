// ============================================================================
// ISL JVM Code Generator - Spring Boot Integration
// ============================================================================

import type {
  Domain,
  Behavior,
  Entity,
  Field,
  TypeDefinition,
  ErrorSpec,
} from '../../../../master_contracts/ast';
import type { GeneratorOptions } from '../generator';

// ============================================================================
// SPRING CONTROLLER GENERATOR
// ============================================================================

export function generateSpringController(
  domain: Domain,
  options: GeneratorOptions
): string {
  const controllerName = `${domain.name.name}Controller`;
  const serviceName = `${domain.name.name}Service`;
  const serviceVar = toCamelCase(serviceName);
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.controllers;`);
  lines.push('');

  // Imports
  lines.push(`import ${options.package}.behaviors.*;`);
  lines.push(`import ${options.package}.entities.*;`);
  lines.push(`import ${options.package}.services.${serviceName};`);
  lines.push('import org.springframework.http.ResponseEntity;');
  lines.push('import org.springframework.web.bind.annotation.*;');
  lines.push('import jakarta.validation.Valid;');
  lines.push('import java.util.UUID;');
  lines.push('import java.util.List;');
  lines.push('');

  // Class declaration
  lines.push('@RestController');
  lines.push(`@RequestMapping("/api/${toKebabCase(domain.name.name)}")`);
  lines.push(`public class ${controllerName} {`);
  lines.push('');

  // Service injection
  lines.push(`    private final ${serviceName} ${serviceVar};`);
  lines.push('');
  lines.push(`    public ${controllerName}(${serviceName} ${serviceVar}) {`);
  lines.push(`        this.${serviceVar} = ${serviceVar};`);
  lines.push('    }');
  lines.push('');

  // Generate endpoints for behaviors
  for (const behavior of domain.behaviors) {
    lines.push(generateBehaviorEndpoint(behavior, serviceVar, options));
    lines.push('');
  }

  // Generate CRUD endpoints for entities
  for (const entity of domain.entities) {
    lines.push(generateEntityEndpoints(entity, serviceVar, options));
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// BEHAVIOR ENDPOINT GENERATION
// ============================================================================

function generateBehaviorEndpoint(
  behavior: Behavior,
  serviceVar: string,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const name = behavior.name.name;
  const methodName = toCamelCase(name);
  const inputType = `${name}Input`;
  const resultType = `${name}Result`;
  const path = toKebabCase(name);

  // Determine HTTP method based on behavior name
  const httpMethod = determineHttpMethod(name);

  // Endpoint annotation
  if (httpMethod === 'POST') {
    lines.push(`    @PostMapping("/${path}")`);
  } else if (httpMethod === 'PUT') {
    lines.push(`    @PutMapping("/${path}")`);
  } else if (httpMethod === 'DELETE') {
    lines.push(`    @DeleteMapping("/${path}")`);
  } else {
    lines.push(`    @GetMapping("/${path}")`);
  }

  // Method signature
  lines.push(`    public ResponseEntity<?> ${methodName}(@Valid @RequestBody ${inputType} input) {`);

  // Switch expression for result handling (Java 17+)
  lines.push(`        return switch (${serviceVar}.${methodName}(input)) {`);

  // Success case
  lines.push(`            case ${resultType}.Success s -> ResponseEntity.ok(s.value());`);

  // Error cases
  for (const error of behavior.output.errors) {
    const errorName = toPascalCase(error.name.name);
    const statusCode = determineStatusCode(error);
    
    if (error.returns) {
      lines.push(`            case ${resultType}.${errorName} e -> ResponseEntity.status(${statusCode}).body(e.details());`);
    } else {
      lines.push(`            case ${resultType}.${errorName} e -> ResponseEntity.status(${statusCode}).body(e);`);
    }
  }

  lines.push(`        };`);
  lines.push(`    }`);

  return lines.join('\n');
}

// ============================================================================
// ENTITY CRUD ENDPOINTS
// ============================================================================

function generateEntityEndpoints(
  entity: Entity,
  serviceVar: string,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const name = entity.name.name;
  const varName = toCamelCase(name);
  const path = toKebabCase(name) + 's';

  // GET all
  lines.push(`    @GetMapping("/${path}")`);
  lines.push(`    public ResponseEntity<List<${name}>> getAll${name}s() {`);
  lines.push(`        return ResponseEntity.ok(${serviceVar}.findAll${name}s());`);
  lines.push(`    }`);
  lines.push('');

  // GET by ID
  lines.push(`    @GetMapping("/${path}/{id}")`);
  lines.push(`    public ResponseEntity<${name}> get${name}ById(@PathVariable UUID id) {`);
  lines.push(`        return ${serviceVar}.find${name}ById(id)`);
  lines.push(`            .map(ResponseEntity::ok)`);
  lines.push(`            .orElse(ResponseEntity.notFound().build());`);
  lines.push(`    }`);
  lines.push('');

  // DELETE by ID
  lines.push(`    @DeleteMapping("/${path}/{id}")`);
  lines.push(`    public ResponseEntity<Void> delete${name}ById(@PathVariable UUID id) {`);
  lines.push(`        ${serviceVar}.delete${name}ById(id);`);
  lines.push(`        return ResponseEntity.noContent().build();`);
  lines.push(`    }`);

  return lines.join('\n');
}

// ============================================================================
// SPRING CONFIGURATION
// ============================================================================

export function generateSpringConfig(
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];
  const configName = `${domain.name.name}Config`;

  // Package declaration
  lines.push(`package ${options.package}.config;`);
  lines.push('');

  // Imports
  lines.push('import org.springframework.context.annotation.Bean;');
  lines.push('import org.springframework.context.annotation.Configuration;');
  lines.push('import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;');
  lines.push('import com.fasterxml.jackson.databind.ObjectMapper;');
  lines.push('import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;');
  lines.push('');

  // Class declaration
  lines.push('@Configuration');
  lines.push(`public class ${configName} {`);
  lines.push('');

  // ObjectMapper bean for JSON handling
  lines.push('    @Bean');
  lines.push('    public ObjectMapper objectMapper() {');
  lines.push('        ObjectMapper mapper = new ObjectMapper();');
  lines.push('        mapper.registerModule(new JavaTimeModule());');
  lines.push('        return mapper;');
  lines.push('    }');
  lines.push('');

  // Validator bean
  lines.push('    @Bean');
  lines.push('    public LocalValidatorFactoryBean validator() {');
  lines.push('        return new LocalValidatorFactoryBean();');
  lines.push('    }');

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// EXCEPTION HANDLER
// ============================================================================

export function generateExceptionHandler(
  domain: Domain,
  options: GeneratorOptions
): string {
  const lines: string[] = [];

  // Package declaration
  lines.push(`package ${options.package}.controllers;`);
  lines.push('');

  // Imports
  lines.push('import org.springframework.http.HttpStatus;');
  lines.push('import org.springframework.http.ResponseEntity;');
  lines.push('import org.springframework.web.bind.MethodArgumentNotValidException;');
  lines.push('import org.springframework.web.bind.annotation.ExceptionHandler;');
  lines.push('import org.springframework.web.bind.annotation.RestControllerAdvice;');
  lines.push('import jakarta.validation.ConstraintViolationException;');
  lines.push('import java.util.Map;');
  lines.push('import java.util.HashMap;');
  lines.push('import java.util.List;');
  lines.push('import java.util.stream.Collectors;');
  lines.push('');

  // Class declaration
  lines.push('@RestControllerAdvice');
  lines.push('public class GlobalExceptionHandler {');
  lines.push('');

  // Validation exception handler
  lines.push('    @ExceptionHandler(MethodArgumentNotValidException.class)');
  lines.push('    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {');
  lines.push('        Map<String, Object> errors = new HashMap<>();');
  lines.push('        errors.put("error", "Validation failed");');
  lines.push('        errors.put("details", ex.getBindingResult().getFieldErrors().stream()');
  lines.push('            .map(e -> Map.of("field", e.getField(), "message", e.getDefaultMessage()))');
  lines.push('            .collect(Collectors.toList()));');
  lines.push('        return ResponseEntity.badRequest().body(errors);');
  lines.push('    }');
  lines.push('');

  // Constraint violation handler
  lines.push('    @ExceptionHandler(ConstraintViolationException.class)');
  lines.push('    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex) {');
  lines.push('        Map<String, Object> errors = new HashMap<>();');
  lines.push('        errors.put("error", "Constraint violation");');
  lines.push('        errors.put("details", ex.getConstraintViolations().stream()');
  lines.push('            .map(v -> Map.of("path", v.getPropertyPath().toString(), "message", v.getMessage()))');
  lines.push('            .collect(Collectors.toList()));');
  lines.push('        return ResponseEntity.badRequest().body(errors);');
  lines.push('    }');
  lines.push('');

  // Generic exception handler
  lines.push('    @ExceptionHandler(IllegalArgumentException.class)');
  lines.push('    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {');
  lines.push('        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));');
  lines.push('    }');

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// OPENAPI GENERATION
// ============================================================================

export function generateOpenApiAnnotations(
  behavior: Behavior,
  options: GeneratorOptions
): string[] {
  const annotations: string[] = [];
  const name = behavior.name.name;

  // Operation annotation
  annotations.push(`@io.swagger.v3.oas.annotations.Operation(`);
  annotations.push(`    summary = "${toSentenceCase(name)}",`);
  if (behavior.description) {
    annotations.push(`    description = "${behavior.description.value}"`);
  }
  annotations.push(`)`);

  // API responses
  annotations.push(`@io.swagger.v3.oas.annotations.responses.ApiResponses({`);
  annotations.push(`    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Success"),`);

  for (const error of behavior.output.errors) {
    const statusCode = determineStatusCode(error);
    annotations.push(`    @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "${statusCode}", description = "${toSentenceCase(error.name.name)}"),`);
  }

  annotations.push(`})`);

  return annotations;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function determineHttpMethod(behaviorName: string): string {
  const name = behaviorName.toLowerCase();
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('register')) {
    return 'POST';
  }
  if (name.startsWith('update') || name.startsWith('edit') || name.startsWith('modify')) {
    return 'PUT';
  }
  if (name.startsWith('delete') || name.startsWith('remove') || name.startsWith('cancel')) {
    return 'DELETE';
  }
  if (name.startsWith('get') || name.startsWith('find') || name.startsWith('list') || name.startsWith('search')) {
    return 'GET';
  }
  return 'POST'; // Default to POST for actions
}

function determineStatusCode(error: ErrorSpec): number {
  const name = error.name.name.toLowerCase();

  if (name.includes('not_found') || name.includes('notfound')) {
    return 404;
  }
  if (name.includes('duplicate') || name.includes('conflict') || name.includes('exists')) {
    return 409;
  }
  if (name.includes('unauthorized') || name.includes('unauthenticated')) {
    return 401;
  }
  if (name.includes('forbidden') || name.includes('access_denied')) {
    return 403;
  }
  if (name.includes('invalid') || name.includes('validation')) {
    return 400;
  }
  if (name.includes('rate_limit') || name.includes('throttle')) {
    return 429;
  }
  if (name.includes('timeout')) {
    return 504;
  }
  if (name.includes('unavailable') || name.includes('service')) {
    return 503;
  }

  // Default to 400 Bad Request
  return 400;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('');
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function toSentenceCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, s => s.toUpperCase());
}
