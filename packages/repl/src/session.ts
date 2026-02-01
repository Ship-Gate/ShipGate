// ============================================================================
// ISL REPL Session State Management
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents an ISL intent definition
 */
export interface Intent {
  name: string;
  preconditions: Condition[];
  postconditions: Condition[];
  invariants: Condition[];
  scenarios: Scenario[];
  rawSource: string;
}

/**
 * A condition (pre/post/invariant)
 */
export interface Condition {
  expression: string;
  description?: string;
}

/**
 * A scenario for testing
 */
export interface Scenario {
  name: string;
  given: string[];
  when: string;
  then: string[];
}

/**
 * Session configuration
 */
export interface SessionConfig {
  colors?: boolean;
  verbose?: boolean;
  cwd?: string;
}

/**
 * Session state management for the ISL REPL
 */
export class Session {
  /** Defined intents in this session */
  private intents: Map<string, Intent> = new Map();
  
  /** Variables set during the session */
  private variables: Map<string, unknown> = new Map();
  
  /** Command history */
  private history: string[] = [];
  
  /** Last evaluation result */
  private lastResult: unknown = undefined;
  
  /** Loaded files */
  private loadedFiles: Set<string> = new Set();
  
  /** Session configuration */
  private config: SessionConfig;

  constructor(config: SessionConfig = {}) {
    this.config = {
      colors: true,
      verbose: false,
      cwd: process.cwd(),
      ...config,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Intent Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Define a new intent
   */
  defineIntent(intent: Intent): void {
    this.intents.set(intent.name, intent);
  }

  /**
   * Get an intent by name
   */
  getIntent(name: string): Intent | undefined {
    return this.intents.get(name);
  }

  /**
   * Get all defined intents
   */
  getAllIntents(): Intent[] {
    return Array.from(this.intents.values());
  }

  /**
   * Check if an intent exists
   */
  hasIntent(name: string): boolean {
    return this.intents.has(name);
  }

  /**
   * Remove an intent
   */
  removeIntent(name: string): boolean {
    return this.intents.delete(name);
  }

  /**
   * Get intent names for completion
   */
  getIntentNames(): string[] {
    return Array.from(this.intents.keys());
  }

  /**
   * Parse an intent definition from source code
   */
  parseIntent(source: string): Intent | null {
    const trimmed = source.trim();
    
    // Match intent declaration: intent Name { ... }
    const match = trimmed.match(/^intent\s+(\w+)\s*\{([\s\S]*)\}$/);
    if (!match) {
      return null;
    }

    const name = match[1]!;
    const body = match[2]!;

    const intent: Intent = {
      name,
      preconditions: [],
      postconditions: [],
      invariants: [],
      scenarios: [],
      rawSource: source,
    };

    // Parse preconditions
    const preMatch = body.match(/pre(?:conditions?)?\s*:\s*([^\n]+)/g);
    if (preMatch) {
      for (const pre of preMatch) {
        const expr = pre.replace(/pre(?:conditions?)?\s*:\s*/, '').trim();
        if (expr) {
          intent.preconditions.push({ expression: expr });
        }
      }
    }

    // Parse postconditions
    const postMatch = body.match(/post(?:conditions?)?\s*:\s*([^\n]+)/g);
    if (postMatch) {
      for (const post of postMatch) {
        const expr = post.replace(/post(?:conditions?)?\s*:\s*/, '').trim();
        if (expr) {
          intent.postconditions.push({ expression: expr });
        }
      }
    }

    // Parse invariants
    const invMatch = body.match(/invariants?\s*:\s*([^\n]+)/g);
    if (invMatch) {
      for (const inv of invMatch) {
        const expr = inv.replace(/invariants?\s*:\s*/, '').trim();
        if (expr) {
          intent.invariants.push({ expression: expr });
        }
      }
    }

    return intent;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variable Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set a variable
   */
  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  /**
   * Get a variable
   */
  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  /**
   * Get all variables
   */
  getAllVariables(): Map<string, unknown> {
    return new Map(this.variables);
  }

  /**
   * Check if a variable exists
   */
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  /**
   * Set the last result (accessible as _)
   */
  setLastResult(value: unknown): void {
    this.lastResult = value;
    this.variables.set('_', value);
  }

  /**
   * Get the last result
   */
  getLastResult(): unknown {
    return this.lastResult;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // History Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add to history
   */
  addToHistory(entry: string): void {
    const trimmed = entry.trim();
    if (trimmed && (this.history.length === 0 || this.history[this.history.length - 1] !== trimmed)) {
      this.history.push(trimmed);
    }
  }

  /**
   * Get history
   */
  getHistory(count?: number): string[] {
    if (count) {
      return this.history.slice(-count);
    }
    return [...this.history];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // File Loading
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load intents from an ISL file
   */
  async loadFile(filePath: string): Promise<{ intents: Intent[]; errors: string[] }> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.config.cwd!, filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { intents: [], errors: [`File not found: ${resolvedPath}`] };
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const loadedIntents: Intent[] = [];
      const errors: string[] = [];

      // Find all intent definitions in the file
      const intentRegex = /intent\s+(\w+)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g;
      let match;
      
      while ((match = intentRegex.exec(content)) !== null) {
        const intent = this.parseIntent(match[0]);
        if (intent) {
          this.defineIntent(intent);
          loadedIntents.push(intent);
        } else {
          errors.push(`Failed to parse intent starting at position ${match.index}`);
        }
      }

      // Also try to parse domain-style ISL with behaviors
      const behaviorRegex = /behavior\s+(\w+)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
      while ((match = behaviorRegex.exec(content)) !== null) {
        const intent = this.parseBehaviorAsIntent(match[1]!, match[2]!);
        if (intent) {
          this.defineIntent(intent);
          loadedIntents.push(intent);
        }
      }

      this.loadedFiles.add(resolvedPath);

      return { intents: loadedIntents, errors };
    } catch (error) {
      return {
        intents: [],
        errors: [`Failed to load file: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * Parse a behavior block as an intent
   */
  private parseBehaviorAsIntent(name: string, body: string): Intent | null {
    const intent: Intent = {
      name,
      preconditions: [],
      postconditions: [],
      invariants: [],
      scenarios: [],
      rawSource: `behavior ${name} {${body}}`,
    };

    // Parse preconditions block
    const preSection = body.match(/pre(?:conditions)?\s*\{([^}]*)\}/s);
    if (preSection) {
      const conditions = preSection[1]!.trim().split('\n').map(l => l.trim()).filter(Boolean);
      for (const cond of conditions) {
        // Remove leading dash if present
        const expr = cond.replace(/^-\s*/, '').trim();
        if (expr) {
          intent.preconditions.push({ expression: expr });
        }
      }
    }

    // Parse postconditions block
    const postSection = body.match(/post(?:conditions)?\s*\{([^}]*)\}/s);
    if (postSection) {
      const conditions = postSection[1]!.trim().split('\n').map(l => l.trim()).filter(Boolean);
      for (const cond of conditions) {
        const expr = cond.replace(/^-\s*/, '').trim();
        if (expr) {
          intent.postconditions.push({ expression: expr });
        }
      }
    }

    // Parse invariants block
    const invSection = body.match(/invariants?\s*\{([^}]*)\}/s);
    if (invSection) {
      const conditions = invSection[1]!.trim().split('\n').map(l => l.trim()).filter(Boolean);
      for (const cond of conditions) {
        const expr = cond.replace(/^-\s*/, '').trim();
        if (expr) {
          intent.invariants.push({ expression: expr });
        }
      }
    }

    return intent;
  }

  /**
   * Export session intents to a file
   */
  async exportToFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.config.cwd!, filePath);

    try {
      const lines: string[] = [];
      lines.push('// Exported ISL intents');
      lines.push(`// Generated at ${new Date().toISOString()}`);
      lines.push('');

      for (const intent of this.intents.values()) {
        lines.push(`intent ${intent.name} {`);
        
        for (const pre of intent.preconditions) {
          lines.push(`  pre: ${pre.expression}`);
        }
        
        for (const post of intent.postconditions) {
          lines.push(`  post: ${post.expression}`);
        }
        
        for (const inv of intent.invariants) {
          lines.push(`  invariant: ${inv.expression}`);
        }
        
        lines.push('}');
        lines.push('');
      }

      fs.writeFileSync(resolvedPath, lines.join('\n'));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to export: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // State Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clear all session state
   */
  clear(): void {
    this.intents.clear();
    this.variables.clear();
    this.lastResult = undefined;
    this.loadedFiles.clear();
    // Keep history
  }

  /**
   * Get session summary
   */
  getSummary(): {
    intentCount: number;
    variableCount: number;
    loadedFileCount: number;
    historyCount: number;
  } {
    return {
      intentCount: this.intents.size,
      variableCount: this.variables.size,
      loadedFileCount: this.loadedFiles.size,
      historyCount: this.history.length,
    };
  }

  /**
   * Get loaded files
   */
  getLoadedFiles(): string[] {
    return Array.from(this.loadedFiles);
  }

  /**
   * Get config
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  setConfig(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a new session
 */
export function createSession(config?: SessionConfig): Session {
  return new Session(config);
}
