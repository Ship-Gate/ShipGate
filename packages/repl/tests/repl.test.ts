// ============================================================================
// ISL REPL Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Session,
  createSession,
  ISLREPL,
  CompletionProvider,
  metaCommands,
  islCommands,
  findSimilarCommand,
  formatSuccess,
  formatError,
  formatIntent,
  highlightExpression,
  stripColors,
  History,
  MemoryHistory,
  COMMANDS,
  KEYWORDS,
} from '../src/index';

// ============================================================================
// Session Tests
// ============================================================================

describe('Session', () => {
  let session: Session;

  beforeEach(() => {
    session = createSession();
  });

  describe('Intent Management', () => {
    it('defines and retrieves intents', () => {
      const intent = {
        name: 'Greeting',
        preconditions: [{ expression: 'name.length > 0' }],
        postconditions: [{ expression: 'result.startsWith("Hello")' }],
        invariants: [],
        scenarios: [],
        rawSource: 'intent Greeting { ... }',
      };

      session.defineIntent(intent);
      
      expect(session.hasIntent('Greeting')).toBe(true);
      expect(session.getIntent('Greeting')).toEqual(intent);
      expect(session.getIntentNames()).toContain('Greeting');
    });

    it('lists all intents', () => {
      session.defineIntent({
        name: 'Intent1',
        preconditions: [],
        postconditions: [],
        invariants: [],
        scenarios: [],
        rawSource: '',
      });
      session.defineIntent({
        name: 'Intent2',
        preconditions: [],
        postconditions: [],
        invariants: [],
        scenarios: [],
        rawSource: '',
      });

      const intents = session.getAllIntents();
      expect(intents.length).toBe(2);
      expect(intents.map(i => i.name)).toContain('Intent1');
      expect(intents.map(i => i.name)).toContain('Intent2');
    });

    it('removes intents', () => {
      session.defineIntent({
        name: 'ToRemove',
        preconditions: [],
        postconditions: [],
        invariants: [],
        scenarios: [],
        rawSource: '',
      });

      expect(session.hasIntent('ToRemove')).toBe(true);
      session.removeIntent('ToRemove');
      expect(session.hasIntent('ToRemove')).toBe(false);
    });

    it('parses intent from source', () => {
      const source = `intent Greeting {
        pre: name.length > 0
        post: result.startsWith("Hello")
      }`;

      const intent = session.parseIntent(source);
      
      expect(intent).not.toBeNull();
      expect(intent!.name).toBe('Greeting');
      expect(intent!.preconditions.length).toBe(1);
      expect(intent!.postconditions.length).toBe(1);
    });
  });

  describe('Variable Management', () => {
    it('sets and gets variables', () => {
      session.setVariable('x', 42);
      session.setVariable('name', 'test');

      expect(session.getVariable('x')).toBe(42);
      expect(session.getVariable('name')).toBe('test');
      expect(session.hasVariable('x')).toBe(true);
      expect(session.hasVariable('nonexistent')).toBe(false);
    });

    it('tracks last result', () => {
      session.setLastResult({ success: true });
      
      expect(session.getLastResult()).toEqual({ success: true });
      expect(session.getVariable('_')).toEqual({ success: true });
    });
  });

  describe('History Management', () => {
    it('adds to and retrieves history', () => {
      session.addToHistory('command 1');
      session.addToHistory('command 2');
      session.addToHistory('command 3');

      const history = session.getHistory();
      expect(history.length).toBe(3);
      expect(history).toContain('command 1');
      expect(history).toContain('command 3');
    });

    it('retrieves limited history', () => {
      for (let i = 0; i < 10; i++) {
        session.addToHistory(`command ${i}`);
      }

      const history = session.getHistory(3);
      expect(history.length).toBe(3);
      expect(history[0]).toBe('command 7');
      expect(history[2]).toBe('command 9');
    });

    it('deduplicates consecutive entries', () => {
      session.addToHistory('same');
      session.addToHistory('same');
      session.addToHistory('same');

      expect(session.getHistory().length).toBe(1);
    });
  });

  describe('State Management', () => {
    it('clears session state', () => {
      session.defineIntent({
        name: 'Test',
        preconditions: [],
        postconditions: [],
        invariants: [],
        scenarios: [],
        rawSource: '',
      });
      session.setVariable('x', 1);

      session.clear();

      expect(session.getAllIntents().length).toBe(0);
      expect(session.getAllVariables().size).toBe(0);
    });

    it('provides session summary', () => {
      session.defineIntent({
        name: 'Test',
        preconditions: [],
        postconditions: [],
        invariants: [],
        scenarios: [],
        rawSource: '',
      });
      session.setVariable('x', 1);

      const summary = session.getSummary();
      
      expect(summary.intentCount).toBe(1);
      expect(summary.variableCount).toBe(1);
    });
  });
});

// ============================================================================
// History Tests
// ============================================================================

describe('History', () => {
  it('adds entries and navigates', () => {
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
    history.add(':gen typescript');

    const results = history.search('load');
    expect(results.length).toBe(2);
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
// Completion Tests
// ============================================================================

describe('CompletionProvider', () => {
  let provider: CompletionProvider;
  let session: Session;

  beforeEach(() => {
    session = createSession();
    session.defineIntent({
      name: 'Greeting',
      preconditions: [{ expression: 'name.length > 0' }],
      postconditions: [{ expression: 'result.startsWith("Hello")' }],
      invariants: [],
      scenarios: [],
      rawSource: '',
    });
    provider = new CompletionProvider(session);
  });

  it('completes meta commands', () => {
    const [items] = provider.complete('.he');
    expect(items.some(i => i.text === '.help')).toBe(true);
  });

  it('completes ISL commands', () => {
    const [items] = provider.complete(':ch');
    expect(items.some(i => i.text === ':check')).toBe(true);
  });

  it('completes all meta commands for bare .', () => {
    const [items] = provider.complete('.');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.text.startsWith('.'))).toBe(true);
  });

  it('completes all ISL commands for bare :', () => {
    const [items] = provider.complete(':');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.text.startsWith(':'))).toBe(true);
  });

  it('completes intent names', () => {
    const [items] = provider.complete('Greet');
    expect(items.some(i => i.text === 'Greeting' && i.type === 'intent')).toBe(true);
  });

  it('completes keywords', () => {
    const [items] = provider.complete('tr');
    expect(items.some(i => i.text === 'true' && i.type === 'keyword')).toBe(true);
  });

  it('gets all completions', () => {
    const all = provider.getAllCompletions();
    expect(all.metaCommands.length).toBeGreaterThan(0);
    expect(all.islCommands.length).toBeGreaterThan(0);
    expect(all.keywords.length).toBeGreaterThan(0);
    expect(all.intents.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Command Tests
// ============================================================================

describe('Commands', () => {
  describe('Meta Commands', () => {
    it('has help command', () => {
      const helpCmd = metaCommands.find(c => c.name === 'help');
      expect(helpCmd).toBeDefined();
      expect(helpCmd!.aliases).toContain('h');
    });

    it('has exit command', () => {
      const exitCmd = metaCommands.find(c => c.name === 'exit');
      expect(exitCmd).toBeDefined();
      expect(exitCmd!.aliases).toContain('quit');
    });

    it('has clear command', () => {
      const clearCmd = metaCommands.find(c => c.name === 'clear');
      expect(clearCmd).toBeDefined();
    });

    it('has history command', () => {
      const histCmd = metaCommands.find(c => c.name === 'history');
      expect(histCmd).toBeDefined();
    });
  });

  describe('ISL Commands', () => {
    it('has check command', () => {
      const checkCmd = islCommands.find(c => c.name === 'check');
      expect(checkCmd).toBeDefined();
      expect(checkCmd!.aliases).toContain('c');
    });

    it('has gen command', () => {
      const genCmd = islCommands.find(c => c.name === 'gen');
      expect(genCmd).toBeDefined();
      expect(genCmd!.aliases).toContain('generate');
    });

    it('has load command', () => {
      const loadCmd = islCommands.find(c => c.name === 'load');
      expect(loadCmd).toBeDefined();
    });

    it('has list command', () => {
      const listCmd = islCommands.find(c => c.name === 'list');
      expect(listCmd).toBeDefined();
      expect(listCmd!.aliases).toContain('ls');
    });

    it('has inspect command', () => {
      const inspectCmd = islCommands.find(c => c.name === 'inspect');
      expect(inspectCmd).toBeDefined();
      expect(inspectCmd!.aliases).toContain('i');
    });

    it('has export command', () => {
      const exportCmd = islCommands.find(c => c.name === 'export');
      expect(exportCmd).toBeDefined();
      expect(exportCmd!.aliases).toContain('save');
    });
  });

  describe('Command Suggestion', () => {
    it('suggests similar meta command', () => {
      expect(findSimilarCommand('hlep', 'meta')).toBe('help');
      expect(findSimilarCommand('exti', 'meta')).toBe('exit');
    });

    it('suggests similar ISL command', () => {
      expect(findSimilarCommand('chekc', 'isl')).toBe('check');
      expect(findSimilarCommand('listt', 'isl')).toBe('list');
    });

    it('returns null for very different input', () => {
      expect(findSimilarCommand('xyzabc', 'meta')).toBeNull();
    });
  });
});

// ============================================================================
// Formatter Tests
// ============================================================================

describe('Formatter', () => {
  describe('Message Formatting', () => {
    it('formats success message', () => {
      const msg = formatSuccess('Test passed');
      expect(stripColors(msg)).toContain('✓');
      expect(stripColors(msg)).toContain('Test passed');
    });

    it('formats error message', () => {
      const msg = formatError('Something failed');
      expect(stripColors(msg)).toContain('✗');
      expect(stripColors(msg)).toContain('Error');
      expect(stripColors(msg)).toContain('Something failed');
    });
  });

  describe('Intent Formatting', () => {
    it('formats intent with pre/post conditions', () => {
      const intent = {
        name: 'Greeting',
        preconditions: [{ expression: 'name.length > 0' }],
        postconditions: [{ expression: 'result.startsWith("Hello")' }],
        invariants: [],
        scenarios: [],
        rawSource: '',
      };

      const formatted = formatIntent(intent);
      expect(stripColors(formatted)).toContain('Intent: Greeting');
      expect(stripColors(formatted)).toContain('Preconditions:');
      expect(stripColors(formatted)).toContain('name.length > 0');
      expect(stripColors(formatted)).toContain('Postconditions:');
      expect(stripColors(formatted)).toContain('result.startsWith');
    });
  });

  describe('Expression Highlighting', () => {
    it('highlights operators', () => {
      const highlighted = highlightExpression('x > 0 and y < 10');
      expect(highlighted).toContain('and');
      expect(highlighted).toContain('>');
    });

    it('highlights boolean values', () => {
      const highlighted = highlightExpression('value == true');
      expect(highlighted).toContain('true');
    });
  });

  describe('Strip Colors', () => {
    it('removes ANSI codes', () => {
      const colored = '\x1b[31mRed\x1b[0m and \x1b[32mGreen\x1b[0m';
      expect(stripColors(colored)).toBe('Red and Green');
    });
  });
});

// ============================================================================
// REPL Integration Tests
// ============================================================================

describe('ISLREPL', () => {
  let repl: ISLREPL;

  beforeEach(() => {
    repl = new ISLREPL({ colors: false });
  });

  it('starts with empty session', () => {
    const session = repl.getSession();
    expect(session.getAllIntents().length).toBe(0);
  });

  it('executes help command', async () => {
    const result = await repl.executeOnce('.help');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Meta Commands');
    expect(result.output).toContain('ISL Commands');
  });

  it('executes list command with no intents', async () => {
    const result = await repl.executeOnce(':list');
    expect(result.success).toBe(true);
    expect(result.output).toContain('No intents defined');
  });

  it('returns error for unknown meta command', async () => {
    const result = await repl.executeOnce('.unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command');
  });

  it('returns error for unknown ISL command', async () => {
    const result = await repl.executeOnce(':unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command');
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Constants', () => {
  it('has commands defined', () => {
    expect(COMMANDS.length).toBeGreaterThan(0);
    expect(COMMANDS.some(c => c.text === '.help')).toBe(true);
    expect(COMMANDS.some(c => c.text === ':check')).toBe(true);
  });

  it('has keywords defined', () => {
    expect(KEYWORDS.length).toBeGreaterThan(0);
    expect(KEYWORDS.some(k => k.text === 'true')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'false')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'and')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'or')).toBe(true);
    expect(KEYWORDS.some(k => k.text === 'intent')).toBe(true);
  });
});
