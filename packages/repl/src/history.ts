// ============================================================================
// Command History Management
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Command history manager with persistence
 */
export class History {
  private entries: string[] = [];
  private position: number = -1;
  private maxSize: number;
  private historyFile: string;
  private unsavedCount: number = 0;
  private autoSaveThreshold: number = 10;

  constructor(options: {
    maxSize?: number;
    historyFile?: string;
    autoSaveThreshold?: number;
  } = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.historyFile = options.historyFile ?? this.getDefaultHistoryFile();
    this.autoSaveThreshold = options.autoSaveThreshold ?? 10;
  }

  /**
   * Get default history file path
   */
  private getDefaultHistoryFile(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.isl_repl_history');
  }

  /**
   * Load history from file
   */
  load(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        this.entries = content
          .split('\n')
          .filter(line => line.trim() !== '')
          .slice(-this.maxSize);
        this.position = this.entries.length;
      }
    } catch {
      // Ignore errors, start with empty history
    }
  }

  /**
   * Save history to file
   */
  save(): void {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, this.entries.join('\n') + '\n');
      this.unsavedCount = 0;
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Add entry to history
   */
  add(entry: string): void {
    const trimmed = entry.trim();
    if (trimmed === '') return;

    // Don't add duplicates of the last entry
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) {
      this.position = this.entries.length;
      return;
    }

    this.entries.push(trimmed);

    // Trim to max size
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(-this.maxSize);
    }

    this.position = this.entries.length;
    this.unsavedCount++;

    // Auto-save periodically
    if (this.unsavedCount >= this.autoSaveThreshold) {
      this.save();
    }
  }

  /**
   * Get previous entry (for up arrow)
   */
  previous(): string | null {
    if (this.entries.length === 0) return null;
    
    if (this.position > 0) {
      this.position--;
    }
    
    return this.entries[this.position] ?? null;
  }

  /**
   * Get next entry (for down arrow)
   */
  next(): string | null {
    if (this.entries.length === 0) return null;
    
    if (this.position < this.entries.length - 1) {
      this.position++;
      return this.entries[this.position] ?? null;
    }
    
    this.position = this.entries.length;
    return '';
  }

  /**
   * Reset position to end
   */
  resetPosition(): void {
    this.position = this.entries.length;
  }

  /**
   * Search history for entries containing text
   */
  search(text: string): string[] {
    const lower = text.toLowerCase();
    return this.entries.filter(entry => 
      entry.toLowerCase().includes(lower)
    );
  }

  /**
   * Search backwards from current position
   */
  searchBackward(text: string): string | null {
    const lower = text.toLowerCase();
    for (let i = this.position - 1; i >= 0; i--) {
      if (this.entries[i]!.toLowerCase().includes(lower)) {
        this.position = i;
        return this.entries[i]!;
      }
    }
    return null;
  }

  /**
   * Search forward from current position
   */
  searchForward(text: string): string | null {
    const lower = text.toLowerCase();
    for (let i = this.position + 1; i < this.entries.length; i++) {
      if (this.entries[i]!.toLowerCase().includes(lower)) {
        this.position = i;
        return this.entries[i]!;
      }
    }
    return null;
  }

  /**
   * Get all entries
   */
  getAll(): string[] {
    return [...this.entries];
  }

  /**
   * Get recent entries
   */
  getRecent(count: number): string[] {
    return this.entries.slice(-count);
  }

  /**
   * Clear history
   */
  clear(): void {
    this.entries = [];
    this.position = 0;
    this.save();
  }

  /**
   * Get history size
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Get current position
   */
  get currentPosition(): number {
    return this.position;
  }
}

/**
 * In-memory history (no persistence)
 */
export class MemoryHistory extends History {
  constructor(maxSize: number = 1000) {
    super({ maxSize, historyFile: '' });
  }

  override load(): void {
    // No-op for memory history
  }

  override save(): void {
    // No-op for memory history
  }
}
