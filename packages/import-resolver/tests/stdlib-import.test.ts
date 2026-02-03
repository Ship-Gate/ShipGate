// ============================================================================
// Stdlib Import Resolution Integration Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ImportResolver,
  createVirtualFS,
} from '../src/index.js';
import { resetStdlibRegistry } from '../src/stdlib-registry.js';

describe('Stdlib Import Resolution', () => {
  beforeEach(() => {
    resetStdlibRegistry();
  });

  describe('Using @isl/datetime', () => {
    it('should recognize datetime stdlib imports', async () => {
      const files = {
        'main.isl': `
          domain OrderProcessing {
            version: "1.0.0"
            
            use @isl/datetime
            
            entity Order {
              id: UUID [immutable]
              created_at: Timestamp
              expires_at: Timestamp
              
              invariants {
                expires_at > created_at
              }
            }
            
            behavior CreateOrder {
              input {
                items: List<Item>
              }
              
              post success {
                result.expires_at == AddDuration(result.created_at, DAY_MS * 7)
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      
      // Should recognize stdlib import without error
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Using @isl/strings', () => {
    it('should recognize strings stdlib imports', async () => {
      const files = {
        'main.isl': `
          domain UserRegistration {
            version: "1.0.0"
            
            use @isl/strings
            
            behavior RegisterUser {
              input {
                email: String
                username: String
              }
              
              pre {
                IsValidEmail(email)
                Length(username) >= 3
                IsAlphanumeric(username)
              }
              
              post success {
                result.email == ToLowerCase(input.email)
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Using @isl/crypto', () => {
    it('should recognize crypto stdlib imports', async () => {
      const files = {
        'main.isl': `
          domain Authentication {
            version: "1.0.0"
            
            use @isl/crypto
            
            behavior CreateUser {
              input {
                email: String
                password: String
              }
              
              post success {
                result.password_hash == HashPassword(input.password)
              }
              
              invariants {
                password never_stored_plaintext
              }
            }
            
            behavior VerifyWebhook {
              input {
                payload: String
                signature: String
                secret: String
              }
              
              pre {
                VerifyHmac(payload, secret, signature, HMAC_SHA256)
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Using @isl/uuid', () => {
    it('should recognize uuid stdlib imports', async () => {
      const files = {
        'main.isl': `
          domain ResourceManagement {
            version: "1.0.0"
            
            use @isl/uuid
            
            behavior CreateResource {
              input {
                name: String
              }
              
              post success {
                IsValidUUID(result.id)
                result.id == GenerateUUID()
              }
            }
            
            behavior GetResource {
              input {
                id: String
              }
              
              pre {
                IsValidUUID(id)
                not IsNilUUID(id)
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Using @isl/json', () => {
    it('should recognize json stdlib imports', async () => {
      const files = {
        'main.isl': `
          domain WebhookProcessing {
            version: "1.0.0"
            
            use @isl/json
            
            behavior ProcessWebhook {
              input {
                payload: String
              }
              
              pre {
                IsValid(payload)
              }
              
              post success {
                data = Parse(input.payload)
                GetString(data, "$.event_type") != null
              }
            }
            
            behavior FormatResponse {
              input {
                data: JSONObject
              }
              
              post success {
                result == Stringify(input.data, PRETTY)
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Multiple stdlib imports', () => {
    it('should support multiple stdlib modules in one file', async () => {
      const files = {
        'main.isl': `
          domain CompleteApp {
            version: "1.0.0"
            
            use @isl/datetime
            use @isl/strings
            use @isl/crypto
            use @isl/uuid
            use @isl/json
            
            entity User {
              id: UUID
              email: String
              password_hash: String
              created_at: Timestamp
              metadata: JSONObject
            }
            
            behavior CreateUser {
              input {
                email: String
                password: String
              }
              
              pre {
                IsValidEmail(email)
                Length(password) >= 8
              }
              
              post success {
                IsValidUUID(result.id)
                result.email == ToLowerCase(input.email)
                result.password_hash == HashPassword(input.password)
                result.created_at <= Now()
              }
            }
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });

  describe('Stdlib alias imports', () => {
    it('should resolve stdlib-datetime alias', async () => {
      const files = {
        'main.isl': `
          domain Test {
            version: "1.0.0"
            use stdlib-datetime
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });

    it('should resolve stdlib-strings alias', async () => {
      const files = {
        'main.isl': `
          domain Test {
            version: "1.0.0"
            use stdlib-strings
          }
        `,
      };

      const vfs = createVirtualFS(files, '/test');
      const resolver = new ImportResolver({
        basePath: '/test',
        enableImports: true,
        ...vfs,
      });

      const result = await resolver.resolve('main.isl');
      expect(result.errors.filter(e => e.code === 'MODULE_NOT_FOUND')).toHaveLength(0);
    });
  });
});

describe('End-to-End Stdlib Integration', () => {
  it('should resolve a comprehensive spec using all 10 stdlib modules', async () => {
    const files = {
      'comprehensive.isl': `
        domain ComprehensiveApp {
          version: "1.0.0"
          description: "Uses all 10 stdlib modules"
          
          # Original 5 modules
          use @isl/auth
          use @isl/rate-limit
          use @isl/audit
          use @isl/payments
          use @isl/uploads
          
          # New 5 modules
          use @isl/datetime
          use @isl/strings
          use @isl/crypto
          use @isl/uuid
          use @isl/json
          
          # Entity using types from multiple modules
          entity Transaction {
            id: UUID
            user_id: UUID
            amount: Decimal
            currency: String
            status: String
            created_at: Timestamp
            metadata: JSONObject
          }
          
          behavior ProcessTransaction {
            input {
              user_id: String
              amount: Decimal
              currency: String
            }
            
            pre {
              # UUID validation
              IsValidUUID(user_id)
              
              # String validation
              IsAlpha(currency)
              Length(currency) == 3
              
              # Amount validation
              amount > 0
            }
            
            post success {
              # UUID generation
              IsValidUUID(result.id)
              
              # Timestamp handling
              result.created_at <= Now()
              
              # String operations
              result.currency == ToUpperCase(input.currency)
              
              # JSON handling
              IsValid(Stringify(result.metadata))
            }
            
            security {
              rate_limit 100 per minute per user_id
            }
            
            temporal {
              eventually within 5s: audit log updated
            }
          }
        }
      `,
    };

    const vfs = createVirtualFS(files, '/test');
    const resolver = new ImportResolver({
      basePath: '/test',
      enableImports: true,
      ...vfs,
    });

    const result = await resolver.resolve('comprehensive.isl');
    
    // Should have no MODULE_NOT_FOUND errors
    const moduleErrors = result.errors.filter(e => e.code === 'MODULE_NOT_FOUND');
    expect(moduleErrors).toHaveLength(0);
  });
});
