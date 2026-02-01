// ============================================================================
// REPL Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ISLRepl,
  History,
  MemoryHistory,
  CompletionProvider,
  Evaluator,
  formatValue,
  formatType,
  formatExpression,
  formatEntity,
  formatBehavior,
  checkCommand,
  generateCommand,
  verifyCommand,
  inspectCommand,
  helpCommand,
  loadFromString,
  COMMANDS,
  KEYWORDS,
  type Domain,
  type ReplContext,
  type EvalContext,
} from '../src/index.js';

// ============================================================================
// Test Domain
// ============================================================================

const testDomain: Domain = {
  kind: 'Domain',
  name: { name: 'TestDomain' },
  version: { value: '1.0.0' },
  imports: [],
  types: [
    {
      kind: 'TypeDeclaration',
      name: { name: 'Email' },
      definition: {
        kind: 'ConstrainedType',
        base: { kind: 'PrimitiveType', name: 'String' },
        constraints: [
          { kind: 'Constraint', name: 'format', value: { kind: 'LiteralExpression', value: 'email', type: 'string' } }
        ],
      },
      annotations: [],
    },
    {
      kind: 'TypeDeclaration',
      name: { name: 'Status' },
      definition: {
        kind: 'EnumType',
        variants: [
          { kind: 'EnumVariant', name: { name: 'ACTIVE' } },
          { kind: 'EnumVariant', name: { name: 'INACTIVE' } },
          { kind: 'EnumVariant', name: { name: 'PENDING' } },
        ],
      },
      annotations: [],
    },
  ],
  entities: [
    {
      kind: 'Entity',
      name: { name: 'User' },
      description: { value: 'A user in the system' },
      fields: [
        { kind: 'Field', name: { name: 'id' }, type: { kind: 'PrimitiveType', name: 'UUID' }, optional: false, annotations: [] },
        { kind: 'Field', name: { name: 'email' }, type: { kind: 'ReferenceType', name: { name: 'Email' } }, optional: false, annotations: [] },
        { kind: 'Field', name: { name: 'name' }, type: { kind: 'PrimitiveType', name: 'String' }, optional: false, annotations: [] },
        { kind: 'Field', name: { name: 'age' }, type: { kind: 'PrimitiveType', name: 'Int' }, optional: true, annotations: [] },
      ],
      computed: [],
      invariants: [],
      annotations: [],
    },
  ],
  behaviors: [
    {
      kind: 'Behavior',
      name: { name: 'CreateUser' },
      description: { value: 'Create a new user' },
      input: {
        kind: 'BehaviorInput',
        fields: [
          { kind: 'Field', name: { name: 'email' }, type: { kind: 'PrimitiveType', name: 'String' }, optional: false, annotations: [] },
          { kind: 'Field', name: { name: 'name' }, type: { kind: 'PrimitiveType', name: 'String' }, optional: false, annotations: [] },
          { kind: 'Field', name: { name: 'age' }, type: { kind: 'PrimitiveType', name: 'Int' }, optional: true, annotations: [] },
        ],
      },
      output: {
        kind: 'BehaviorOutput',
        success: { kind: 'ReferenceType', name: { name: 'User' } },
        errors: [
          { kind: 'BehaviorError', name: { name: 'EmailAlreadyExists' }, retriable: false },
          { kind: 'BehaviorError', name: { name: 'InvalidEmail' }, retriable: false },
        ],
      },
      preconditions: [],
      postconditions: [],
      sideEffects: [
        { kind: 'SideEffect', entity: { name: 'User' }, action: 'creates' },
      ],
      steps: [],
      annotations: [],
    },
  ],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
};

// ============================================================================
// History Tests
// ============================================================================

describe('History', () => {
  it('adds entries', () => {
    const history = new MemoryHistory();
    history.add('command 1');
    history.add('command 2');
    
    expect(history.size).toBe(2);
    expect(history.getAll()).toContain('command 1');
    expect(history.getAll()).toContain('command 2');
  });

  it('navigates with previous/next', () => {
    const history = new MemoryHistory();
    history.add('first');
    history.add('second');
    history.add('third');

    expect(history.previous()).toBe('third');
    expect(history.previous()).toBe('second');
    expect(history.previous()).toBe('first');
    expect(history.previous()).toBe('first'); // Stays at first
    
    expect(history.next()).toBe('second');
    expect(history.next()).toBe('third');
    expect(history.next()).toBe(''); // End of history
  });

  it('searches history', () => {
    const history = new MemoryHistory();
    history.add(':load file1.isl');
    history.add(':check');
    history.add(':load file2.isl');
    history.add(':generate types');

    const results = history.search('load');
    expect(results.length).toBe(2);
    expect(results).toContain(':load file1.isl');
    expect(results).toContain(':load file2.isl');
  });

  it('deduplicates consecutive entries', () => {
    const history = new MemoryHistory();
    history.add('same');
    history.add('same');
    history.add('same');
    
    expect(history.size).toBe(1);
  });

  it('respects max size', () => {
    const history = new MemoryHistory(5);
    for (let i = 0; i < 10; i++) {
      history.add(`command ${i}`);
    }
    
    expect(history.size).toBe(5);
    expect(history.getAll()).not.toContain('command 0');
    expect(history.getAll()).toContain('command 9');
  });
});

// ============================================================================
// Completions Tests
// ============================================================================

describe('CompletionProvider', () => {
  let provider: CompletionProvider;

  beforeEach(() => {
    const context: ReplContext = {
      domain: testDomain,
      state: new Map(),
      history: [],
      variables: new Map(),
    };
    provider = new CompletionProvider(context);
  });

  it('completes commands', () => {
    const [items] = provider.complete(':lo');
    expect(items.some(i => i.text === ':load')).toBe(true);
  });

  it('completes all commands for bare colon', () => {
    const [items] = provider.complete(':');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.type === 'command')).toBe(true);
  });

  it('completes entity names', () => {
    const [items] = provider.complete('Us');
    expect(items.some(i => i.text === 'User' && i.type === 'entity')).toBe(true);
  });

  it('completes behavior names', () => {
    const [items] = provider.complete('Create');
    expect(items.some(i => i.text === 'CreateUser' && i.type === 'behavior')).toBe(true);
  });

  it('completes keywords', () => {
    const [items] = provider.complete('tr');
    expect(items.some(i => i.text === 'true' && i.type === 'keyword')).toBe(true);
  });

  it('gets all completions', () => {
    const all = provider.getAllCompletions();
    expect(all.commands.length).toBeGreaterThan(0);
    expect(all.keywords.length).toBeGreaterThan(0);
    expect(all.domain.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Evaluator Tests
// ============================================================================

describe('Evaluator', () => {
  let evaluator: Evaluator;

  beforeEach(() => {
    const context: EvalContext = {
      domain: testDomain,
      state: new Map(),
      variables: new Map(),
    };
    evaluator = new Evaluator(context);
  });

  it('evaluates literals', async () => {
    expect((await evaluator.evaluate('42')).value).toBe(42);
    expect((await evaluator.evaluate('"hello"')).value).toBe('hello');
    expect((await evaluator.evaluate('true')).value).toBe(true);
    expect((await evaluator.evaluate('false')).value).toBe(false);
    expect((await evaluator.evaluate('null')).value).toBe(null);
  });

  it('evaluates arithmetic', async () => {
    expect((await evaluator.evaluate('1 + 2')).value).toBe(3);
    expect((await evaluator.evaluate('10 - 3')).value).toBe(7);
    expect((await evaluator.evaluate('4 * 5')).value).toBe(20);
    expect((await evaluator.evaluate('15 / 3')).value).toBe(5);
  });

  it('evaluates comparison', async () => {
    expect((await evaluator.evaluate('5 > 3')).value).toBe(true);
    expect((await evaluator.evaluate('5 < 3')).value).toBe(false);
    expect((await evaluator.evaluate('5 >= 5')).value).toBe(true);
    expect((await evaluator.evaluate('5 == 5')).value).toBe(true);
    expect((await evaluator.evaluate('5 != 3')).value).toBe(true);
  });

  it('evaluates logical operators', async () => {
    expect((await evaluator.evaluate('true and true')).value).toBe(true);
    expect((await evaluator.evaluate('true and false')).value).toBe(false);
    expect((await evaluator.evaluate('true or false')).value).toBe(true);
    expect((await evaluator.evaluate('not true')).value).toBe(false);
    expect((await evaluator.evaluate('false implies true')).value).toBe(true);
  });

  it('evaluates arrays', async () => {
    const result = await evaluator.evaluate('[1, 2, 3]');
    expect(result.value).toEqual([1, 2, 3]);
  });

  it('evaluates objects', async () => {
    const result = await evaluator.evaluate('{a: 1, b: "two"}');
    expect(result.value).toEqual({ a: 1, b: 'two' });
  });

  it('evaluates behavior calls', async () => {
    const result = await evaluator.evaluate('CreateUser(email: "test@example.com", name: "Test")');
    expect(result.success).toBe(true);
    expect(result.value).toHaveProperty('success', true);
  });

  it('handles parse errors gracefully', async () => {
    const result = await evaluator.evaluate('invalid @@@ syntax');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// Formatter Tests
// ============================================================================

describe('Formatter', () => {
  describe('formatValue', () => {
    it('formats primitives', () => {
      expect(formatValue(42, { colors: false })).toBe('42');
      expect(formatValue('hello', { colors: false })).toBe('"hello"');
      expect(formatValue(true, { colors: false })).toBe('true');
      expect(formatValue(null, { colors: false })).toBe('null');
    });

    it('formats arrays', () => {
      const result = formatValue([1, 2, 3], { colors: false, compact: true });
      expect(result).toContain('1');
      expect(result).toContain('2');
      expect(result).toContain('3');
    });

    it('formats objects', () => {
      const result = formatValue({ name: 'test', value: 42 }, { colors: false });
      expect(result).toContain('name');
      expect(result).toContain('test');
      expect(result).toContain('value');
      expect(result).toContain('42');
    });

    it('formats behavior results', () => {
      const success = formatValue({ success: true, data: { id: '123' } }, { colors: false });
      expect(success).toContain('Success');

      const failure = formatValue({ success: false, error: 'Something went wrong' }, { colors: false });
      expect(failure).toContain('Error');
      expect(failure).toContain('Something went wrong');
    });
  });

  describe('formatType', () => {
    it('formats primitive types', () => {
      expect(formatType({ kind: 'PrimitiveType', name: 'String' }, { colors: false })).toBe('String');
      expect(formatType({ kind: 'PrimitiveType', name: 'Int' }, { colors: false })).toBe('Int');
    });

    it('formats reference types', () => {
      expect(formatType({ kind: 'ReferenceType', name: { name: 'User' } }, { colors: false })).toBe('User');
    });

    it('formats list types', () => {
      const result = formatType({
        kind: 'ListType',
        element: { kind: 'PrimitiveType', name: 'String' },
      }, { colors: false });
      expect(result).toBe('List<String>');
    });

    it('formats optional types', () => {
      const result = formatType({
        kind: 'OptionalType',
        inner: { kind: 'PrimitiveType', name: 'Int' },
      }, { colors: false });
      expect(result).toBe('Optional<Int>');
    });
  });

  describe('formatExpression', () => {
    it('formats literals', () => {
      expect(formatExpression({ kind: 'LiteralExpression', value: 42, type: 'number' })).toBe('42');
      expect(formatExpression({ kind: 'LiteralExpression', value: 'hello', type: 'string' })).toBe('"hello"');
    });

    it('formats identifiers', () => {
      expect(formatExpression({ kind: 'IdentifierExpression', name: 'user' })).toBe('user');
    });

    it('formats binary expressions', () => {
      const expr = {
        kind: 'BinaryExpression' as const,
        operator: '+',
        left: { kind: 'LiteralExpression' as const, value: 1, type: 'number' as const },
        right: { kind: 'LiteralExpression' as const, value: 2, type: 'number' as const },
      };
      expect(formatExpression(expr)).toBe('1 + 2');
    });
  });

  describe('formatEntity', () => {
    it('formats entity with fields', () => {
      const result = formatEntity(testDomain.entities[0]!, { colors: false });
      expect(result).toContain('Entity: User');
      expect(result).toContain('Fields:');
      expect(result).toContain('id');
      expect(result).toContain('email');
      expect(result).toContain('name');
    });
  });

  describe('formatBehavior', () => {
    it('formats behavior with input/output', () => {
      const result = formatBehavior(testDomain.behaviors[0]!, { colors: false });
      expect(result).toContain('Behavior: CreateUser');
      expect(result).toContain('Input:');
      expect(result).toContain('Output:');
      expect(result).toContain('email');
      expect(result).toContain('name');
    });
  });
});

// ============================================================================
// Command Tests
// ============================================================================

describe('Commands', () => {
  describe('checkCommand', () => {
    it('returns error when no domain loaded', () => {
      const result = checkCommand(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No domain loaded');
    });

    it('checks valid domain', () => {
      const result = checkCommand(testDomain);
      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });
  });

  describe('generateCommand', () => {
    it('returns error when no domain loaded', () => {
      const result = generateCommand('types', null);
      expect(result.success).toBe(false);
    });

    it('generates types', () => {
      const result = generateCommand('types', testDomain);
      expect(result.success).toBe(true);
      expect(result.data).toContain('interface User');
      expect(result.data).toContain('interface CreateUserInput');
    });

    it('generates tests', () => {
      const result = generateCommand('tests', testDomain);
      expect(result.success).toBe(true);
      expect(result.data).toContain('describe');
      expect(result.data).toContain('User');
      expect(result.data).toContain('CreateUser');
    });

    it('generates docs', () => {
      const result = generateCommand('docs', testDomain);
      expect(result.success).toBe(true);
      expect(result.data).toContain('# TestDomain');
      expect(result.data).toContain('## Entities');
      expect(result.data).toContain('## Behaviors');
    });

    it('generates api', () => {
      const result = generateCommand('api', testDomain);
      expect(result.success).toBe(true);
      expect(result.data).toContain('router.post');
      expect(result.data).toContain('create-user');
    });

    it('generates schema', () => {
      const result = generateCommand('schema', testDomain);
      expect(result.success).toBe(true);
      expect(result.data).toContain('CREATE TABLE');
      expect(result.data).toContain('user');
    });

    it('rejects unknown target', () => {
      const result = generateCommand('unknown', testDomain);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown generate target');
    });
  });

  describe('verifyCommand', () => {
    it('returns error when no domain loaded', () => {
      const result = verifyCommand('CreateUser', null, new Map());
      expect(result.success).toBe(false);
    });

    it('returns error for unknown behavior', () => {
      const result = verifyCommand('Unknown', testDomain, new Map());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown behavior');
    });

    it('verifies behavior', () => {
      const result = verifyCommand('CreateUser', testDomain, new Map());
      expect(result.success).toBe(true);
      expect(result.message).toContain('Verification');
      expect(result.message).toContain('CreateUser');
    });
  });

  describe('inspectCommand', () => {
    it('returns error when no domain loaded', () => {
      const result = inspectCommand('User', null);
      expect(result.success).toBe(false);
    });

    it('inspects entity', () => {
      const result = inspectCommand('User', testDomain);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Entity: User');
      expect(result.message).toContain('Fields');
    });

    it('inspects behavior', () => {
      const result = inspectCommand('CreateUser', testDomain);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Behavior: CreateUser');
      expect(result.message).toContain('Input');
      expect(result.message).toContain('Output');
    });

    it('shows domain summary when no name given', () => {
      const result = inspectCommand(undefined, testDomain);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Domain: TestDomain');
    });

    it('returns error for unknown name', () => {
      const result = inspectCommand('Unknown', testDomain);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not found');
    });
  });

  describe('helpCommand', () => {
    it('shows general help', () => {
      const result = helpCommand();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Commands:');
      expect(result.message).toContain('Expressions:');
    });

    it('shows commands help', () => {
      const result = helpCommand('commands');
      expect(result.success).toBe(true);
      expect(result.message).toContain(':load');
      expect(result.message).toContain(':check');
    });

    it('shows expressions help', () => {
      const result = helpCommand('expressions');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Literals');
      expect(result.message).toContain('Operators');
    });

    it('returns error for unknown topic', () => {
      const result = helpCommand('unknown');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown help topic');
    });
  });

  describe('loadFromString', () => {
    it('loads simple domain', () => {
      const result = loadFromString(`
        domain MyDomain
        version "1.0.0"
        
        entity User {
          id: UUID
          name: String
        }
        
        behavior CreateUser {
        }
      `);
      
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();
      expect(result.domain?.name.name).toBe('MyDomain');
      expect(result.domain?.entities.length).toBeGreaterThan(0);
    });

    it('returns error for invalid ISL', () => {
      const result = loadFromString('not valid isl');
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// REPL Integration Tests
// ============================================================================

describe('ISLRepl', () => {
  let repl: ISLRepl;

  beforeEach(() => {
    repl = new ISLRepl({ colors: false });
  });

  it('starts with no domain', () => {
    expect(repl.getDomain()).toBeNull();
  });

  it('can set domain directly', () => {
    repl.setDomain(testDomain);
    expect(repl.getDomain()).toBe(testDomain);
  });

  it('executes check command', async () => {
    repl.setDomain(testDomain);
    const result = await repl.executeOnce(':check');
    expect(result.success).toBe(true);
  });

  it('executes generate command', async () => {
    repl.setDomain(testDomain);
    const result = await repl.executeOnce(':generate types');
    expect(result.success).toBe(true);
  });

  it('executes inspect command', async () => {
    repl.setDomain(testDomain);
    const result = await repl.executeOnce(':inspect User');
    expect(result.success).toBe(true);
  });

  it('executes help command', async () => {
    const result = await repl.executeOnce(':help');
    expect(result.success).toBe(true);
  });

  it('evaluates expressions', async () => {
    repl.setDomain(testDomain);
    const result = await repl.executeOnce('1 + 2');
    expect(result.success).toBe(true);
    expect(result.data).toBe(3);
  });

  it('returns error for unknown command', async () => {
    const result = await repl.executeOnce(':unknown');
    expect(result.success).toBe(false);
  });

  it('returns error for expression without domain', async () => {
    const result = await repl.executeOnce('1 + 2');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No domain loaded');
  });

  it('maintains state', () => {
    repl.setDomain(testDomain);
    const state = repl.getState();
    expect(state).toBeInstanceOf(Map);
  });

  it('maintains variables', () => {
    repl.setDomain(testDomain);
    const variables = repl.getVariables();
    expect(variables).toBeInstanceOf(Map);
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Constants', () => {
  it('has commands defined', () => {
    expect(COMMANDS.length).toBeGreaterThan(0);
    expect(COMMANDS.some(c => c.text === ':load')).toBe(true);
    expect(COMMANDS.some(c => c.text === ':check')).toBe(true);
    expect(COMMANDS.some(c => c.text === ':help')).toBe(true);
  });

  it('has keywords defined', () => {
    expect(KEYWORDS.length).toBeGreaterThan(0);
    expect(KEYWORDS.some(k => k.text === 'true')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'false')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'and')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'or')).toBe(true);
  });
});
