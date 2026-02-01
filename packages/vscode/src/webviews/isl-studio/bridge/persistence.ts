/**
 * ISL Studio - Persistence Layer
 * 
 * Handles persistent storage of ISL Studio state including:
 * - Recent prompts (last 20)
 * - Last selected spec path
 * - Last selected report path
 * 
 * All state is stored in .vibecheck/studio/state.json
 */

import { createStudioPaths, type StudioPaths } from '../shared/paths';
import { readJson, writeJson, updateJson, ensureDir } from '../shared/jsonStore';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum number of recent prompts to keep
 */
export const MAX_RECENT_PROMPTS = 20;

/**
 * State file version for migrations
 */
export const STATE_VERSION = 1;

// ============================================================================
// State Types
// ============================================================================

/**
 * A stored prompt entry with metadata
 */
export interface StoredPrompt {
  /** The prompt text */
  text: string;
  /** When the prompt was used */
  timestamp: number;
  /** Optional: mode used with this prompt */
  mode?: 'generate' | 'generateAndBuild';
}

/**
 * Persisted studio state schema
 */
export interface PersistedStudioState {
  /** Schema version for migrations */
  version: number;
  /** Recent prompts (newest first) */
  recentPrompts: StoredPrompt[];
  /** Last selected spec file path */
  lastSpecPath: string | null;
  /** Last selected report file path */
  lastReportPath: string | null;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * Create default empty state
 */
export function createDefaultState(): PersistedStudioState {
  return {
    version: STATE_VERSION,
    recentPrompts: [],
    lastSpecPath: null,
    lastReportPath: null,
    lastModified: Date.now(),
  };
}

// ============================================================================
// Persistence Manager
// ============================================================================

/**
 * Options for StudioPersistence
 */
export interface StudioPersistenceOptions {
  /** Maximum number of prompts to store */
  maxPrompts?: number;
  /** Whether to deduplicate prompts */
  deduplicatePrompts?: boolean;
}

const DEFAULT_OPTIONS: Required<StudioPersistenceOptions> = {
  maxPrompts: MAX_RECENT_PROMPTS,
  deduplicatePrompts: true,
};

/**
 * Manages persistent storage for ISL Studio
 */
export class StudioPersistence {
  private readonly paths: StudioPaths;
  private readonly options: Required<StudioPersistenceOptions>;
  private state: PersistedStudioState | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(workspaceRoot: string, options: StudioPersistenceOptions = {}) {
    this.paths = createStudioPaths(workspaceRoot);
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize the persistence layer
   * Creates directories and loads existing state
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    // Ensure storage directory exists
    await ensureDir(this.paths.studioDir);

    // Load existing state
    this.state = await readJson<PersistedStudioState>(
      this.paths.statePath,
      createDefaultState()
    );

    // Migrate if needed
    if (this.state.version < STATE_VERSION) {
      this.state = this.migrateState(this.state);
      await this.save();
    }
  }

  /**
   * Migrate state from older versions
   */
  private migrateState(state: PersistedStudioState): PersistedStudioState {
    // Currently only version 1, no migrations needed
    return {
      ...createDefaultState(),
      ...state,
      version: STATE_VERSION,
    };
  }

  /**
   * Get the current state (initializes if needed)
   */
  async getState(): Promise<PersistedStudioState> {
    await this.initialize();
    return this.state!;
  }

  /**
   * Save the current state to disk
   */
  private async save(): Promise<void> {
    if (!this.state) {
      return;
    }

    this.state.lastModified = Date.now();
    await writeJson(this.paths.statePath, this.state);
  }

  // ==========================================================================
  // Prompt Management
  // ==========================================================================

  /**
   * Add a prompt to the recent prompts list
   * @param prompt - The prompt text
   * @param mode - Optional generation mode
   */
  async addPrompt(prompt: string, mode?: 'generate' | 'generateAndBuild'): Promise<void> {
    await this.initialize();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    const newEntry: StoredPrompt = {
      text: trimmedPrompt,
      timestamp: Date.now(),
      mode,
    };

    // Remove duplicate if deduplication is enabled
    if (this.options.deduplicatePrompts) {
      this.state!.recentPrompts = this.state!.recentPrompts.filter(
        (p) => p.text !== trimmedPrompt
      );
    }

    // Add to front of list
    this.state!.recentPrompts.unshift(newEntry);

    // Trim to max length
    if (this.state!.recentPrompts.length > this.options.maxPrompts) {
      this.state!.recentPrompts = this.state!.recentPrompts.slice(
        0,
        this.options.maxPrompts
      );
    }

    await this.save();
  }

  /**
   * Get recent prompts
   * @param limit - Maximum number to return (default: all)
   */
  async getRecentPrompts(limit?: number): Promise<StoredPrompt[]> {
    await this.initialize();
    const prompts = this.state!.recentPrompts;
    return limit ? prompts.slice(0, limit) : prompts;
  }

  /**
   * Get recent prompt texts only (without metadata)
   */
  async getRecentPromptTexts(limit?: number): Promise<string[]> {
    const prompts = await this.getRecentPrompts(limit);
    return prompts.map((p) => p.text);
  }

  /**
   * Clear all recent prompts
   */
  async clearPrompts(): Promise<void> {
    await this.initialize();
    this.state!.recentPrompts = [];
    await this.save();
  }

  /**
   * Remove a specific prompt
   */
  async removePrompt(promptText: string): Promise<boolean> {
    await this.initialize();
    const initialLength = this.state!.recentPrompts.length;
    this.state!.recentPrompts = this.state!.recentPrompts.filter(
      (p) => p.text !== promptText
    );
    
    if (this.state!.recentPrompts.length !== initialLength) {
      await this.save();
      return true;
    }
    return false;
  }

  // ==========================================================================
  // Path Management
  // ==========================================================================

  /**
   * Set the last selected spec path
   */
  async setLastSpecPath(specPath: string | null): Promise<void> {
    await this.initialize();
    this.state!.lastSpecPath = specPath;
    await this.save();
  }

  /**
   * Get the last selected spec path
   */
  async getLastSpecPath(): Promise<string | null> {
    await this.initialize();
    return this.state!.lastSpecPath;
  }

  /**
   * Set the last selected report path
   */
  async setLastReportPath(reportPath: string | null): Promise<void> {
    await this.initialize();
    this.state!.lastReportPath = reportPath;
    await this.save();
  }

  /**
   * Get the last selected report path
   */
  async getLastReportPath(): Promise<string | null> {
    await this.initialize();
    return this.state!.lastReportPath;
  }

  /**
   * Update both paths at once
   */
  async updatePaths(
    specPath?: string | null,
    reportPath?: string | null
  ): Promise<void> {
    await this.initialize();
    
    if (specPath !== undefined) {
      this.state!.lastSpecPath = specPath;
    }
    if (reportPath !== undefined) {
      this.state!.lastReportPath = reportPath;
    }
    
    await this.save();
  }

  // ==========================================================================
  // Full State Operations
  // ==========================================================================

  /**
   * Get a summary of the current state
   */
  async getSummary(): Promise<{
    recentPrompts: string[];
    lastSpecPath: string | null;
    lastReportPath: string | null;
  }> {
    await this.initialize();
    return {
      recentPrompts: this.state!.recentPrompts.map((p) => p.text),
      lastSpecPath: this.state!.lastSpecPath,
      lastReportPath: this.state!.lastReportPath,
    };
  }

  /**
   * Reset all state to defaults
   */
  async reset(): Promise<void> {
    this.state = createDefaultState();
    await this.save();
  }

  /**
   * Export state for backup
   */
  async export(): Promise<PersistedStudioState> {
    await this.initialize();
    return { ...this.state! };
  }

  /**
   * Import state from backup
   */
  async import(state: Partial<PersistedStudioState>): Promise<void> {
    await this.initialize();
    
    // Merge with current state, preserving version
    this.state = {
      ...this.state!,
      ...state,
      version: STATE_VERSION,
      lastModified: Date.now(),
    };
    
    // Validate and trim prompts
    if (this.state.recentPrompts.length > this.options.maxPrompts) {
      this.state.recentPrompts = this.state.recentPrompts.slice(
        0,
        this.options.maxPrompts
      );
    }
    
    await this.save();
  }

  /**
   * Get the storage path
   */
  getStatePath(): string {
    return this.paths.statePath;
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

let defaultInstance: StudioPersistence | null = null;

/**
 * Get or create the default persistence instance
 */
export function getStudioPersistence(workspaceRoot: string): StudioPersistence {
  if (!defaultInstance) {
    defaultInstance = new StudioPersistence(workspaceRoot);
  }
  return defaultInstance;
}

/**
 * Reset the default instance (for testing)
 */
export function resetStudioPersistence(): void {
  defaultInstance = null;
}
