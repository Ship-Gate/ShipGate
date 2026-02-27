// ============================================================================
// Test Fixtures - Reusable ISL domain builders for Terraform generator tests
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

export function loc(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

// ---------------------------------------------------------------------------
// Domain 1: Payments  (entities + compliance + rate-limit + temporal SLO)
// ---------------------------------------------------------------------------

export function createPaymentsDomain(): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name: 'Payments', location: loc() },
    version: { kind: 'StringLiteral', value: '2.0.0', location: loc() },
    imports: [],
    types: [],
    entities: [createPaymentEntity()],
    behaviors: [createPaymentBehavior()],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  };
}

function createPaymentEntity(): AST.Entity {
  return {
    kind: 'Entity',
    name: { kind: 'Identifier', name: 'Payment', location: loc() },
    fields: [
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'id', location: loc() },
        type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'amount', location: loc() },
        type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'status', location: loc() },
        type: { kind: 'PrimitiveType', name: 'String', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
    ],
    invariants: [],
    location: loc(),
  };
}

function createPaymentBehavior(): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name: 'CreatePayment', location: loc() },
    input: {
      kind: 'InputSpec',
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'amount', location: loc() },
          type: { kind: 'PrimitiveType', name: 'Decimal', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
      ],
      location: loc(),
    },
    output: {
      kind: 'OutputSpec',
      success: {
        kind: 'ReferenceType',
        name: {
          kind: 'QualifiedName',
          parts: [{ kind: 'Identifier', name: 'Payment', location: loc() }],
          location: loc(),
        },
        location: loc(),
      },
      errors: [],
      location: loc(),
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [
      {
        kind: 'TemporalSpec',
        operator: 'within',
        predicate: { kind: 'Identifier', name: 'response', location: loc() },
        duration: { kind: 'DurationLiteral', value: 500, unit: 'ms', location: loc() },
        percentile: 99,
        location: loc(),
      },
    ],
    security: [
      {
        kind: 'SecuritySpec',
        type: 'rate_limit',
        details: { kind: 'NumberLiteral', value: 1000, isFloat: false, location: loc() },
        location: loc(),
      },
    ],
    compliance: [
      {
        kind: 'ComplianceSpec',
        standard: { kind: 'Identifier', name: 'pci_dss', location: loc() },
        requirements: [],
        location: loc(),
      },
    ],
    location: loc(),
  };
}

// ---------------------------------------------------------------------------
// Domain 2: Inventory  (entities + async behaviors + file storage hints)
//   - No compliance → simpler infra
//   - Two behaviors (one async-like) → queue inferred
//   - Entity present → database inferred
// ---------------------------------------------------------------------------

export function createInventoryDomain(): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name: 'Inventory', location: loc() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: loc() },
    imports: [],
    types: [],
    entities: [createProductEntity()],
    behaviors: [createAddProductBehavior(), createUploadImageBehavior()],
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
    chaos: [],
    location: loc(),
  };
}

function createProductEntity(): AST.Entity {
  return {
    kind: 'Entity',
    name: { kind: 'Identifier', name: 'Product', location: loc() },
    fields: [
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'id', location: loc() },
        type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'name', location: loc() },
        type: { kind: 'PrimitiveType', name: 'String', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'quantity', location: loc() },
        type: { kind: 'PrimitiveType', name: 'Int', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
    ],
    invariants: [],
    location: loc(),
  };
}

function createAddProductBehavior(): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name: 'AddProduct', location: loc() },
    input: {
      kind: 'InputSpec',
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'name', location: loc() },
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'quantity', location: loc() },
          type: { kind: 'PrimitiveType', name: 'Int', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
      ],
      location: loc(),
    },
    output: {
      kind: 'OutputSpec',
      success: {
        kind: 'ReferenceType',
        name: {
          kind: 'QualifiedName',
          parts: [{ kind: 'Identifier', name: 'Product', location: loc() }],
          location: loc(),
        },
        location: loc(),
      },
      errors: [],
      location: loc(),
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [],
    security: [],
    compliance: [],
    location: loc(),
  };
}

function createUploadImageBehavior(): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name: 'UploadImage', location: loc() },
    input: {
      kind: 'InputSpec',
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'productId', location: loc() },
          type: { kind: 'PrimitiveType', name: 'UUID', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'imageData', location: loc() },
          type: { kind: 'PrimitiveType', name: 'String', location: loc() },
          optional: false,
          annotations: [],
          location: loc(),
        },
      ],
      location: loc(),
    },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'String', location: loc() },
      errors: [],
      location: loc(),
    },
    preconditions: [],
    postconditions: [],
    invariants: [],
    temporal: [
      {
        kind: 'TemporalSpec',
        operator: 'within',
        predicate: { kind: 'Identifier', name: 'response', location: loc() },
        duration: { kind: 'DurationLiteral', value: 5, unit: 'seconds', location: loc() },
        percentile: 95,
        location: loc(),
      },
    ],
    security: [],
    compliance: [],
    location: loc(),
  };
}
