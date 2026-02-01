/**
 * Mock State Management
 *
 * In-memory state management for mock server.
 */

import { v4 as uuidv4 } from 'uuid';

export interface StateOptions {
  /** Initial state data */
  initialState?: Record<string, unknown[]>;
  /** Auto-generate IDs for new items */
  autoId?: boolean;
  /** ID field name */
  idField?: string;
}

export class MockState {
  private state: Map<string, unknown[]>;
  private initialState: Record<string, unknown[]>;
  private options: Required<StateOptions>;

  constructor(options: StateOptions = {}) {
    this.options = {
      initialState: options.initialState ?? {},
      autoId: options.autoId ?? true,
      idField: options.idField ?? 'id',
    };

    this.initialState = this.options.initialState;
    this.state = new Map();
    this.reset();
  }

  /**
   * Reset state to initial values
   */
  reset(): void {
    this.state.clear();
    for (const [key, value] of Object.entries(this.initialState)) {
      this.state.set(key, JSON.parse(JSON.stringify(value)));
    }
  }

  /**
   * Get all items for an entity
   */
  get(entity: string): unknown[] {
    return this.state.get(entity) ?? [];
  }

  /**
   * Get all state
   */
  getAll(): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {};
    for (const [key, value] of this.state.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Set all items for an entity
   */
  set(entity: string, items: unknown[]): void {
    this.state.set(entity, items);
  }

  /**
   * Add an item to an entity collection
   */
  add(entity: string, item: unknown): unknown {
    const items = this.get(entity);
    const itemWithId = this.ensureId(item);
    items.push(itemWithId);
    this.state.set(entity, items);
    return itemWithId;
  }

  /**
   * Find an item by ID
   */
  findById(entity: string, id: string): unknown | undefined {
    const items = this.get(entity);
    return items.find((item) => this.getId(item) === id);
  }

  /**
   * Find items matching a predicate
   */
  find(entity: string, predicate: (item: unknown) => boolean): unknown[] {
    const items = this.get(entity);
    return items.filter(predicate);
  }

  /**
   * Find first item matching a predicate
   */
  findOne(entity: string, predicate: (item: unknown) => boolean): unknown | undefined {
    const items = this.get(entity);
    return items.find(predicate);
  }

  /**
   * Update an item by ID
   */
  update(entity: string, id: string, updates: Record<string, unknown>): unknown | undefined {
    const items = this.get(entity);
    const index = items.findIndex((item) => this.getId(item) === id);

    if (index === -1) {
      return undefined;
    }

    const existing = items[index] as Record<string, unknown>;
    const updated = {
      ...existing,
      ...updates,
      [this.options.idField]: id, // Preserve ID
      updated_at: new Date().toISOString(),
    };

    items[index] = updated;
    this.state.set(entity, items);
    return updated;
  }

  /**
   * Delete an item by ID
   */
  delete(entity: string, id: string): boolean {
    const items = this.get(entity);
    const index = items.findIndex((item) => this.getId(item) === id);

    if (index === -1) {
      return false;
    }

    items.splice(index, 1);
    this.state.set(entity, items);
    return true;
  }

  /**
   * Delete items matching a predicate
   */
  deleteWhere(entity: string, predicate: (item: unknown) => boolean): number {
    const items = this.get(entity);
    const remaining = items.filter((item) => !predicate(item));
    const deleted = items.length - remaining.length;
    this.state.set(entity, remaining);
    return deleted;
  }

  /**
   * Count items for an entity
   */
  count(entity: string): number {
    return this.get(entity).length;
  }

  /**
   * Count items matching a predicate
   */
  countWhere(entity: string, predicate: (item: unknown) => boolean): number {
    return this.find(entity, predicate).length;
  }

  /**
   * Check if an item exists by ID
   */
  exists(entity: string, id: string): boolean {
    return this.findById(entity, id) !== undefined;
  }

  /**
   * Check if any item matches a predicate
   */
  existsWhere(entity: string, predicate: (item: unknown) => boolean): boolean {
    return this.findOne(entity, predicate) !== undefined;
  }

  /**
   * Clear all items for an entity
   */
  clear(entity: string): void {
    this.state.set(entity, []);
  }

  /**
   * Clear all state
   */
  clearAll(): void {
    this.state.clear();
  }

  /**
   * Get unique values for a field
   */
  distinct(entity: string, field: string): unknown[] {
    const items = this.get(entity);
    const values = new Set<unknown>();

    for (const item of items) {
      const value = (item as Record<string, unknown>)[field];
      if (value !== undefined) {
        values.add(value);
      }
    }

    return Array.from(values);
  }

  /**
   * Group items by a field
   */
  groupBy(entity: string, field: string): Record<string, unknown[]> {
    const items = this.get(entity);
    const groups: Record<string, unknown[]> = {};

    for (const item of items) {
      const value = String((item as Record<string, unknown>)[field] ?? 'undefined');
      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(item);
    }

    return groups;
  }

  /**
   * Sort items by a field
   */
  sort(
    entity: string,
    field: string,
    order: 'asc' | 'desc' = 'asc'
  ): unknown[] {
    const items = this.get(entity);
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[field];
      const bVal = (b as Record<string, unknown>)[field];

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get paginated items
   */
  paginate(
    entity: string,
    page: number,
    pageSize: number
  ): { items: unknown[]; total: number; page: number; pageSize: number; totalPages: number } {
    const items = this.get(entity);
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const paginatedItems = items.slice(offset, offset + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Clone state for testing
   */
  clone(): MockState {
    const cloned = new MockState({ ...this.options });
    for (const [key, value] of this.state.entries()) {
      cloned.set(key, JSON.parse(JSON.stringify(value)));
    }
    return cloned;
  }

  /**
   * Import state from JSON
   */
  import(data: Record<string, unknown[]>): void {
    for (const [key, value] of Object.entries(data)) {
      this.state.set(key, value);
    }
  }

  /**
   * Export state to JSON
   */
  export(): Record<string, unknown[]> {
    return this.getAll();
  }

  private ensureId(item: unknown): unknown {
    const itemObj = item as Record<string, unknown>;

    if (this.options.autoId && !itemObj[this.options.idField]) {
      return {
        ...itemObj,
        [this.options.idField]: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return item;
  }

  private getId(item: unknown): string | undefined {
    return (item as Record<string, unknown>)[this.options.idField] as string | undefined;
  }
}
