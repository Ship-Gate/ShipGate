/**
 * OAuth Test Generation Strategy
 * 
 * Generates OAuth-specific test cases for authentication and authorization flows.
 * Covers:
 * - Token validation and expiry
 * - PKCE flow verification
 * - Scope validation
 * - Client authentication
 * - Refresh token rotation
 */

import type {
  TestGenerationStrategy,
  StrategyContext,
  GeneratedTestCase,
  MockSetup,
  ImportSpec,
  TestValue,
} from '../testGenTypes.js';

export const oauthStrategy: TestGenerationStrategy = {
  id: 'oauth',
  name: 'OAuth 2.0 Strategy',
  appliesTo: ['OAuth', 'Auth', 'Authentication', 'Authorization'],

  generateTests(context: StrategyContext): GeneratedTestCase[] {
    const tests: GeneratedTestCase[] = [];
    const { behaviorName, inputFields, errors } = context;

    // Token exchange tests
    if (behaviorName.includes('Exchange') || behaviorName.includes('Token')) {
      tests.push(...generateTokenExchangeTests(context));
    }

    // Authorization tests
    if (behaviorName.includes('Authorize')) {
      tests.push(...generateAuthorizationTests(context));
    }

    // Refresh token tests
    if (behaviorName.includes('Refresh')) {
      tests.push(...generateRefreshTokenTests(context));
    }

    // Revocation tests
    if (behaviorName.includes('Revoke')) {
      tests.push(...generateRevocationTests(context));
    }

    // PKCE tests
    if (inputFields.some(f => f.name.includes('code_challenge') || f.name.includes('code_verifier'))) {
      tests.push(...generatePKCETests(context));
    }

    return tests;
  },

  generateMocks(context: StrategyContext): MockSetup[] {
    const mocks: MockSetup[] = [];

    // OAuth client mock
    mocks.push({
      entity: 'OAuthClient',
      method: 'exists',
      args: { client_id: { type: 'reference', path: 'input.client_id' } },
      returns: { type: 'literal', value: true },
    });

    mocks.push({
      entity: 'OAuthClient',
      method: 'lookup',
      args: { client_id: { type: 'reference', path: 'input.client_id' } },
      returns: {
        type: 'literal',
        value: {
          id: 'mock-client-id',
          client_id: 'test-client',
          is_active: true,
          redirect_uris: ['https://app.example.com/callback'],
          allowed_scopes: ['read', 'write'],
        },
      },
    });

    // Authorization grant mock
    mocks.push({
      entity: 'AuthorizationGrant',
      method: 'exists',
      returns: { type: 'literal', value: true },
    });

    mocks.push({
      entity: 'AuthorizationGrant',
      method: 'lookup',
      returns: {
        type: 'literal',
        value: {
          id: 'mock-grant-id',
          code: 'mock-auth-code',
          used: false,
          expires_at: new Date(Date.now() + 600000).toISOString(),
        },
      },
    });

    return mocks;
  },

  getImports(): ImportSpec[] {
    return [
      {
        module: '@/test-utils/oauth',
        imports: ['createMockOAuthClient', 'createMockAuthorizationGrant', 'createMockToken'],
      },
      {
        module: 'crypto',
        imports: ['createHash', 'randomBytes'],
      },
    ];
  },
};

function generateTokenExchangeTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Valid token exchange
  tests.push({
    id: `${behaviorName}_oauth_valid_exchange`,
    name: 'should exchange valid authorization code for tokens',
    description: 'Tests successful OAuth token exchange with valid authorization code',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'OAuthToken.exists(access_token: result.access_token)',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'authorization_code' },
        code: { type: 'literal', value: 'valid-auth-code' },
        redirect_uri: { type: 'literal', value: 'https://app.example.com/callback' },
        client_id: { type: 'literal', value: 'test-client' },
        client_secret: { type: 'literal', value: 'test-secret' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          args: { code: { type: 'literal', value: 'valid-auth-code' } },
          returns: {
            type: 'literal',
            value: {
              code: 'valid-auth-code',
              client_id: 'test-client',
              redirect_uri: 'https://app.example.com/callback',
              used: false,
              expires_at: new Date(Date.now() + 600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.access_token', operator: 'is_not_null', expected: { type: 'literal', value: null } },
        { path: 'result.token_type', operator: 'equals', expected: { type: 'literal', value: 'bearer' } },
        { path: 'result.expires_in', operator: 'greater_than', expected: { type: 'literal', value: 0 } },
      ],
    },
    tags: ['oauth', 'token', 'positive'],
    priority: 'critical',
  });

  // Test: Expired authorization code
  tests.push({
    id: `${behaviorName}_oauth_expired_code`,
    name: 'should reject expired authorization code',
    description: 'Tests that expired authorization codes are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'AuthorizationGrant.lookup(input.code).expires_at > now()',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'authorization_code' },
        code: { type: 'literal', value: 'expired-code' },
        redirect_uri: { type: 'literal', value: 'https://app.example.com/callback' },
        client_id: { type: 'literal', value: 'test-client' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              code: 'expired-code',
              expires_at: new Date(Date.now() - 600000).toISOString(), // Expired
              used: false,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_GRANT',
    },
    tags: ['oauth', 'token', 'negative', 'expiry'],
    priority: 'high',
  });

  // Test: Already used authorization code
  tests.push({
    id: `${behaviorName}_oauth_used_code`,
    name: 'should reject already used authorization code',
    description: 'Tests that authorization codes cannot be reused',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 2,
      expression: 'AuthorizationGrant.lookup(input.code).used == false',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'authorization_code' },
        code: { type: 'literal', value: 'used-code' },
        redirect_uri: { type: 'literal', value: 'https://app.example.com/callback' },
        client_id: { type: 'literal', value: 'test-client' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              code: 'used-code',
              used: true, // Already used
              expires_at: new Date(Date.now() + 600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'CODE_ALREADY_USED',
    },
    tags: ['oauth', 'token', 'negative', 'replay'],
    priority: 'critical',
  });

  // Test: Redirect URI mismatch
  tests.push({
    id: `${behaviorName}_oauth_redirect_mismatch`,
    name: 'should reject mismatched redirect URI',
    description: 'Tests that redirect URI must match the original authorization request',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 3,
      expression: 'AuthorizationGrant.lookup(input.code).redirect_uri == input.redirect_uri',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'authorization_code' },
        code: { type: 'literal', value: 'valid-code' },
        redirect_uri: { type: 'literal', value: 'https://attacker.com/callback' }, // Wrong URI
        client_id: { type: 'literal', value: 'test-client' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              code: 'valid-code',
              redirect_uri: 'https://app.example.com/callback',
              used: false,
              expires_at: new Date(Date.now() + 600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_REDIRECT_URI',
    },
    tags: ['oauth', 'token', 'negative', 'security'],
    priority: 'critical',
  });

  return tests;
}

function generateAuthorizationTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Invalid client
  tests.push({
    id: `${behaviorName}_oauth_invalid_client`,
    name: 'should reject unregistered client',
    description: 'Tests that authorization requests from unregistered clients are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'OAuthClient.exists(client_id: input.client_id)',
    },
    input: {
      params: {
        client_id: { type: 'literal', value: 'unknown-client' },
        redirect_uri: { type: 'literal', value: 'https://app.example.com/callback' },
        response_type: { type: 'literal', value: 'code' },
      },
      mocks: [
        {
          entity: 'OAuthClient',
          method: 'exists',
          args: { client_id: { type: 'literal', value: 'unknown-client' } },
          returns: { type: 'literal', value: false },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_CLIENT',
    },
    tags: ['oauth', 'authorization', 'negative'],
    priority: 'critical',
  });

  // Test: Unregistered redirect URI
  tests.push({
    id: `${behaviorName}_oauth_unregistered_redirect`,
    name: 'should reject unregistered redirect URI',
    description: 'Tests that redirect URIs not registered for the client are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 2,
      expression: 'input.redirect_uri in OAuthClient.lookup(input.client_id).redirect_uris',
    },
    input: {
      params: {
        client_id: { type: 'literal', value: 'test-client' },
        redirect_uri: { type: 'literal', value: 'https://attacker.com/steal' },
        response_type: { type: 'literal', value: 'code' },
      },
      mocks: [
        {
          entity: 'OAuthClient',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              client_id: 'test-client',
              redirect_uris: ['https://app.example.com/callback'],
              is_active: true,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_REDIRECT_URI',
    },
    tags: ['oauth', 'authorization', 'negative', 'security'],
    priority: 'critical',
  });

  return tests;
}

function generateRefreshTokenTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Valid refresh
  tests.push({
    id: `${behaviorName}_oauth_valid_refresh`,
    name: 'should issue new access token with valid refresh token',
    description: 'Tests successful token refresh flow',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'OAuthToken.exists(access_token: result.access_token)',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'refresh_token' },
        refresh_token: { type: 'literal', value: 'valid-refresh-token' },
        client_id: { type: 'literal', value: 'test-client' },
      },
      mocks: [
        {
          entity: 'OAuthToken',
          method: 'exists',
          args: { refresh_token: { type: 'literal', value: 'valid-refresh-token' } },
          returns: { type: 'literal', value: true },
        },
        {
          entity: 'OAuthToken',
          method: 'lookup_by_refresh',
          returns: {
            type: 'literal',
            value: {
              refresh_token: 'valid-refresh-token',
              revoked: false,
              refresh_token_expires_at: new Date(Date.now() + 86400000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
      assertions: [
        { path: 'result.access_token', operator: 'is_not_null', expected: { type: 'literal', value: null } },
      ],
    },
    tags: ['oauth', 'refresh', 'positive'],
    priority: 'critical',
  });

  // Test: Revoked refresh token
  tests.push({
    id: `${behaviorName}_oauth_revoked_refresh`,
    name: 'should reject revoked refresh token',
    description: 'Tests that revoked refresh tokens cannot be used',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 1,
      expression: 'OAuthToken.lookup_by_refresh(input.refresh_token).revoked == false',
    },
    input: {
      params: {
        grant_type: { type: 'literal', value: 'refresh_token' },
        refresh_token: { type: 'literal', value: 'revoked-token' },
        client_id: { type: 'literal', value: 'test-client' },
      },
      mocks: [
        {
          entity: 'OAuthToken',
          method: 'lookup_by_refresh',
          returns: {
            type: 'literal',
            value: {
              refresh_token: 'revoked-token',
              revoked: true,
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_GRANT',
    },
    tags: ['oauth', 'refresh', 'negative', 'security'],
    priority: 'critical',
  });

  return tests;
}

function generateRevocationTests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Successful revocation
  tests.push({
    id: `${behaviorName}_oauth_revoke_success`,
    name: 'should successfully revoke token',
    description: 'Tests that tokens can be revoked',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'postcondition',
      index: 0,
      expression: 'OAuthToken.lookup_by_token(input.token).revoked == true',
    },
    input: {
      params: {
        token: { type: 'literal', value: 'token-to-revoke' },
        client_id: { type: 'literal', value: 'test-client' },
      },
    },
    expected: {
      outcome: 'success',
      stateChanges: [
        {
          entity: 'OAuthToken',
          lookup: { token: { type: 'literal', value: 'token-to-revoke' } },
          property: 'revoked',
          expected: { type: 'literal', value: true },
        },
      ],
    },
    tags: ['oauth', 'revocation', 'positive'],
    priority: 'high',
  });

  return tests;
}

function generatePKCETests(context: StrategyContext): GeneratedTestCase[] {
  const { behaviorName } = context;
  const tests: GeneratedTestCase[] = [];

  // Test: Valid PKCE challenge
  tests.push({
    id: `${behaviorName}_oauth_pkce_valid`,
    name: 'should validate PKCE code verifier',
    description: 'Tests successful PKCE verification',
    behaviorName,
    testType: 'postcondition_success',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'PKCE.verify(input.code_verifier, grant.code_challenge)',
    },
    input: {
      params: {
        code: { type: 'literal', value: 'pkce-auth-code' },
        code_verifier: { type: 'literal', value: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' },
        client_id: { type: 'literal', value: 'mobile-client' },
        redirect_uri: { type: 'literal', value: 'myapp://callback' },
        grant_type: { type: 'literal', value: 'authorization_code' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              code: 'pkce-auth-code',
              code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
              code_challenge_method: 'S256',
              used: false,
              expires_at: new Date(Date.now() + 600000).toISOString(),
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'success',
    },
    tags: ['oauth', 'pkce', 'positive', 'security'],
    priority: 'critical',
  });

  // Test: Invalid PKCE verifier
  tests.push({
    id: `${behaviorName}_oauth_pkce_invalid`,
    name: 'should reject invalid PKCE code verifier',
    description: 'Tests that invalid code verifiers are rejected',
    behaviorName,
    testType: 'precondition_violation',
    sourceClause: {
      clauseType: 'precondition',
      index: 0,
      expression: 'PKCE.verify(input.code_verifier, grant.code_challenge)',
    },
    input: {
      params: {
        code: { type: 'literal', value: 'pkce-auth-code' },
        code_verifier: { type: 'literal', value: 'wrong-verifier' },
        client_id: { type: 'literal', value: 'mobile-client' },
        redirect_uri: { type: 'literal', value: 'myapp://callback' },
        grant_type: { type: 'literal', value: 'authorization_code' },
      },
      mocks: [
        {
          entity: 'AuthorizationGrant',
          method: 'lookup',
          returns: {
            type: 'literal',
            value: {
              code: 'pkce-auth-code',
              code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
              code_challenge_method: 'S256',
            },
          },
        },
      ],
    },
    expected: {
      outcome: 'error',
      errorCode: 'INVALID_CODE_VERIFIER',
    },
    tags: ['oauth', 'pkce', 'negative', 'security'],
    priority: 'critical',
  });

  return tests;
}

export default oauthStrategy;
