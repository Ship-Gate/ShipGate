// ============================================================================
// Test Domain Fixtures — structured ISL AST for golden output tests
// ============================================================================

import type { Domain } from '../src/types.js';

/**
 * UserAuthentication domain (based on examples/auth.isl)
 */
export const authDomain: Domain = {
  name: 'UserAuthentication',
  version: '1.0.0',
  entities: [
    {
      name: 'User',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }, { name: 'unique' }] },
        { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'unique' }, { name: 'indexed' }] },
        { name: 'password_hash', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'secret' }] },
        { name: 'status', type: { kind: 'reference', name: 'UserStatus' }, optional: false, annotations: [{ name: 'indexed' }] },
      ],
    },
    {
      name: 'Session',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }, { name: 'unique' }] },
        { name: 'user_id', type: { kind: 'primitive', name: 'UUID' }, optional: false, annotations: [{ name: 'immutable' }, { name: 'indexed' }] },
        { name: 'expires_at', type: { kind: 'primitive', name: 'Timestamp' }, optional: false },
        { name: 'revoked', type: { kind: 'primitive', name: 'Boolean' }, optional: false },
        { name: 'ip_address', type: { kind: 'primitive', name: 'String' }, optional: false },
      ],
    },
  ],
  behaviors: [
    {
      name: 'Login',
      input: {
        fields: [
          { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false },
          { name: 'password', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'sensitive' }] },
          { name: 'ip_address', type: { kind: 'primitive', name: 'String' }, optional: false },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'Session' },
        errors: [
          { name: 'INVALID_CREDENTIALS', retriable: true },
          { name: 'USER_NOT_FOUND', retriable: false },
          { name: 'USER_LOCKED', retriable: true },
        ],
      },
    },
    {
      name: 'Logout',
      input: {
        fields: [
          { name: 'session_id', type: { kind: 'primitive', name: 'UUID' }, optional: false },
        ],
      },
      output: {
        success: { kind: 'primitive', name: 'Boolean' },
        errors: [{ name: 'SESSION_NOT_FOUND', retriable: false }],
      },
    },
    {
      name: 'Register',
      input: {
        fields: [
          { name: 'email', type: { kind: 'primitive', name: 'String' }, optional: false },
          { name: 'password', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'sensitive' }] },
          { name: 'confirm_password', type: { kind: 'primitive', name: 'String' }, optional: false, annotations: [{ name: 'sensitive' }] },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'User' },
        errors: [
          { name: 'EMAIL_ALREADY_EXISTS', retriable: false },
          { name: 'PASSWORDS_DO_NOT_MATCH', retriable: true },
        ],
      },
    },
  ],
};

/**
 * Payments domain (based on demo/payments.isl)
 */
export const paymentsDomain: Domain = {
  name: 'Payments',
  version: '1.0.0',
  entities: [
    {
      name: 'Account',
      fields: [
        { name: 'id', type: { kind: 'primitive', name: 'UUID' }, optional: false },
        { name: 'balance', type: { kind: 'primitive', name: 'Decimal' }, optional: false },
        { name: 'isActive', type: { kind: 'primitive', name: 'Boolean' }, optional: false },
      ],
    },
  ],
  behaviors: [
    {
      name: 'TransferFunds',
      input: {
        fields: [
          { name: 'senderId', type: { kind: 'primitive', name: 'UUID' }, optional: false },
          { name: 'receiverId', type: { kind: 'primitive', name: 'UUID' }, optional: false },
          { name: 'amount', type: { kind: 'primitive', name: 'Decimal' }, optional: false },
        ],
      },
      output: {
        success: { kind: 'reference', name: 'Account' },
      },
    },
  ],
};
