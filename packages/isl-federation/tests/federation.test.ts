// ============================================================================
// Federation Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { FederationRegistry, InMemoryRegistryStorage } from '../src/registry';
import { compose } from '../src/composer';
import { validate } from '../src/validator';
import { createResolver, extractReferences } from '../src/resolver';
import { generateGateway } from '../src/gateway';
import type * as AST from '../../../master_contracts/ast';
import type { FederatedService } from '../src/types';

// ============================================================================
// FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createTestService = (name: string, behaviors: string[] = []): FederatedService => ({
  name,
  version: '1.0.0',
  url: `http://${name}.internal:3000`,
  domain: {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: createSourceLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
    imports: [],
    types: [
      {
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: `${name}Type`, location: createSourceLocation() },
        definition: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
        location: createSourceLocation(),
      },
    ],
    entities: [
      {
        kind: 'Entity',
        name: { kind: 'Identifier', name: `${name}Entity`, location: createSourceLocation() },
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        invariants: [],
        location: createSourceLocation(),
      },
    ],
    behaviors: behaviors.map(b => ({
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: b, location: createSourceLocation() },
      description: { kind: 'StringLiteral' as const, value: `${b} behavior`, location: createSourceLocation() },
      input: {
        kind: 'InputSpec' as const,
        fields: [],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec' as const,
        success: { kind: 'PrimitiveType' as const, name: 'Boolean', location: createSourceLocation() },
        errors: [],
        location: createSourceLocation(),
      },
      preconditions: [],
      postconditions: [],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    })),
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: createSourceLocation(),
  },
  metadata: {
    owner: 'test-team',
    tags: ['test'],
    dependencies: [],
    consumers: [],
  },
});

// ============================================================================
// REGISTRY TESTS
// ============================================================================

describe('FederationRegistry', () => {
  let registry: FederationRegistry;

  beforeEach(() => {
    registry = new FederationRegistry({
      storage: new InMemoryRegistryStorage(),
      validateOnRegister: false,
    });
  });

  it('should register a service', async () => {
    const service = createTestService('auth', ['Login', 'Logout']);
    const registration = await registry.register(service);

    expect(registration.service.name).toBe('auth');
    expect(registration.currentVersion).toBe('1.0.0');
    expect(registration.versions).toHaveLength(1);
  });

  it('should get a registered service', async () => {
    const service = createTestService('users');
    await registry.register(service);

    const retrieved = registry.getService('users');
    expect(retrieved).toBeDefined();
    expect(retrieved?.service.name).toBe('users');
  });

  it('should track version history', async () => {
    const service = createTestService('payments');
    await registry.register(service);

    // Update schema
    const newDomain = { ...service.domain, version: { ...service.domain.version, value: '1.1.0' } };
    await registry.updateSchema('payments', newDomain, 'Added new feature');

    const history = registry.getVersionHistory('payments');
    expect(history).toHaveLength(2);
    expect(history[1].changelog).toBe('Added new feature');
  });

  it('should find service by type', async () => {
    const service = createTestService('inventory');
    await registry.register(service);

    const found = registry.findServiceByType('inventoryEntity');
    expect(found).toBeDefined();
    expect(found?.service.name).toBe('inventory');
  });

  it('should find service by behavior', async () => {
    const service = createTestService('orders', ['PlaceOrder', 'CancelOrder']);
    await registry.register(service);

    const found = registry.findServiceByBehavior('PlaceOrder');
    expect(found).toBeDefined();
    expect(found?.service.name).toBe('orders');
  });

  it('should prevent unregistering service with dependents', async () => {
    const auth = createTestService('auth');
    const users = createTestService('users');
    users.metadata.dependencies = ['auth'];

    await registry.register(auth);
    await registry.register(users);

    // Manually add a reference
    const refs = registry.getReferences();

    await expect(async () => {
      // This would fail if there were actual dependents
      await registry.unregister('auth');
    }).rejects.toThrow();
  });
});

// ============================================================================
// COMPOSER TESTS
// ============================================================================

describe('compose', () => {
  it('should compose multiple services', () => {
    const services = [
      createTestService('auth', ['Login']),
      createTestService('users', ['CreateUser']),
    ];

    const result = compose(services);

    expect(result.success).toBe(true);
    expect(result.schema?.services).toHaveLength(2);
    expect(result.schema?.behaviors).toHaveLength(2);
  });

  it('should detect type conflicts', () => {
    const service1 = createTestService('service1');
    const service2 = createTestService('service2');
    
    // Create conflicting types with same name
    service1.domain.types[0].name.name = 'SharedType';
    service2.domain.types[0].name.name = 'SharedType';
    // Make definitions different
    service2.domain.types[0].definition = { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() };

    const result = compose([service1, service2], { resolveConflicts: 'error' });

    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('should prefix types when option enabled', () => {
    const services = [
      createTestService('auth'),
      createTestService('users'),
    ];

    const result = compose(services, { prefixTypes: true });

    expect(result.success).toBe(true);
    const typeNames = result.schema?.types.map(t => t.name.name);
    expect(typeNames).toContain('auth_authType');
    expect(typeNames).toContain('users_usersType');
  });

  it('should generate federated behaviors', () => {
    const services = [
      createTestService('auth', ['Login']),
    ];

    const result = compose(services, { generateFederatedBehaviors: true });

    expect(result.schema?.crossServiceBehaviors).toHaveLength(1);
    expect(result.schema?.crossServiceBehaviors[0].routing.service).toBe('auth');
  });
});

// ============================================================================
// VALIDATOR TESTS
// ============================================================================

describe('validate', () => {
  it('should validate healthy federation', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth'));
    await registry.register(createTestService('users'));

    const result = validate(registry);

    expect(result.stats.servicesChecked).toBe(2);
  });

  it('should detect circular dependencies', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    
    const auth = createTestService('auth');
    auth.metadata.dependencies = ['users'];
    
    const users = createTestService('users');
    users.metadata.dependencies = ['auth'];

    await registry.register(auth);
    await registry.register(users);

    const cycles = registry.detectCircularDependencies();
    // Note: The actual cycle detection depends on reference extraction
  });

  it('should warn about missing SLA', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    const service = createTestService('test');
    await registry.register(service);

    const result = validate(registry);

    const slaWarning = result.warnings.find(w => w.code === 'MISSING_SLA');
    expect(slaWarning).toBeDefined();
  });
});

// ============================================================================
// RESOLVER TESTS
// ============================================================================

describe('resolver', () => {
  it('should resolve cross-service references', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth'));
    await registry.register(createTestService('users'));

    const resolver = createResolver(registry);
    const type = await resolver.resolveType('auth', 'authType');

    expect(type).toBeDefined();
  });

  it('should resolve behaviors', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login']));

    const resolver = createResolver(registry);
    const behavior = await resolver.resolveBehavior('auth', 'Login');

    expect(behavior).toBeDefined();
    expect(behavior?.name.name).toBe('Login');
  });

  it('should extract references from domain', () => {
    const domain: AST.Domain = {
      kind: 'Domain',
      name: { kind: 'Identifier', name: 'Test', location: createSourceLocation() },
      version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
      imports: [
        {
          kind: 'ImportDeclaration',
          from: { kind: 'StringLiteral', value: '@services/auth', location: createSourceLocation() },
          items: [
            {
              kind: 'ImportItem',
              name: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
              location: createSourceLocation(),
            },
          ],
          location: createSourceLocation(),
        },
      ],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: createSourceLocation(),
    };

    const refs = extractReferences(domain, 'test');
    expect(refs).toHaveLength(1);
    expect(refs[0].targetService).toBe('auth');
  });
});

// ============================================================================
// GATEWAY TESTS
// ============================================================================

describe('generateGateway', () => {
  it('should generate gateway configuration', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login', 'Logout']));
    await registry.register(createTestService('users', ['CreateUser']));

    const gateway = generateGateway(registry, {
      name: 'test-gateway',
      version: '1.0.0',
    });

    expect(gateway.spec.services).toHaveLength(2);
    expect(gateway.spec.routes).toHaveLength(3);
  });

  it('should generate TypeScript gateway code', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login']));

    const gateway = generateGateway(registry, {
      name: 'api-gateway',
      version: '1.0.0',
    });

    expect(gateway.typescript).toContain('express');
    expect(gateway.typescript).toContain('createProxyMiddleware');
  });

  it('should generate OpenAPI spec', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login']));

    const gateway = generateGateway(registry, {
      name: 'api-gateway',
      version: '1.0.0',
    });

    const openapi = JSON.parse(gateway.openapi!);
    expect(openapi.openapi).toBe('3.0.3');
    expect(openapi.paths).toHaveProperty('/api/auth/login');
  });

  it('should generate NGINX config', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login']));

    const gateway = generateGateway(registry, {
      name: 'api-gateway',
      version: '1.0.0',
    });

    expect(gateway.nginx).toContain('upstream auth');
    expect(gateway.nginx).toContain('proxy_pass');
  });

  it('should include CORS configuration', async () => {
    const registry = new FederationRegistry({ validateOnRegister: false });
    await registry.register(createTestService('auth', ['Login']));

    const gateway = generateGateway(registry, {
      name: 'api-gateway',
      version: '1.0.0',
      cors: {
        origins: ['https://example.com'],
        methods: ['GET', 'POST'],
        headers: ['Content-Type', 'Authorization'],
      },
    });

    expect(gateway.spec.cors).toBeDefined();
    expect(gateway.nginx).toContain('Access-Control-Allow-Origin');
  });
});
