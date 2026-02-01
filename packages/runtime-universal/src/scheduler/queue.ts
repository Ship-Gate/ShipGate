/**
 * Priority Queue implementations for the scheduler
 */

/**
 * Priority queue item
 */
export interface QueueItem<T> {
  value: T;
  priority: number;
}

/**
 * Priority Queue using a binary heap
 */
export class PriorityQueue<T> {
  private heap: QueueItem<T>[] = [];

  /**
   * Get queue size
   */
  get size(): number {
    return this.heap.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Enqueue an item with priority
   */
  enqueue(value: T, priority: number): void {
    this.heap.push({ value, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Dequeue the highest priority item
   */
  dequeue(): T | undefined {
    if (this.isEmpty) return undefined;

    const result = this.heap[0]!.value;
    const last = this.heap.pop()!;

    if (!this.isEmpty) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return result;
  }

  /**
   * Peek at the highest priority item
   */
  peek(): T | undefined {
    return this.heap[0]?.value;
  }

  /**
   * Update priority of an item
   */
  updatePriority(value: T, newPriority: number): boolean {
    const index = this.heap.findIndex((item) => item.value === value);
    if (index === -1) return false;

    const oldPriority = this.heap[index]!.priority;
    this.heap[index]!.priority = newPriority;

    if (newPriority > oldPriority) {
      this.bubbleUp(index);
    } else {
      this.bubbleDown(index);
    }

    return true;
  }

  /**
   * Remove an item from the queue
   */
  remove(value: T): boolean {
    const index = this.heap.findIndex((item) => item.value === value);
    if (index === -1) return false;

    const last = this.heap.pop()!;
    if (index < this.heap.length) {
      this.heap[index] = last;
      this.bubbleUp(index);
      this.bubbleDown(index);
    }

    return true;
  }

  /**
   * Check if value exists in queue
   */
  contains(value: T): boolean {
    return this.heap.some((item) => item.value === value);
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Convert to array (does not modify queue)
   */
  toArray(): T[] {
    return this.heap.map((item) => item.value);
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex]!.priority >= this.heap[index]!.priority) break;

      [this.heap[parentIndex], this.heap[index]] = [
        this.heap[index]!,
        this.heap[parentIndex]!,
      ];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;

    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let largest = index;

      if (
        leftChild < length &&
        this.heap[leftChild]!.priority > this.heap[largest]!.priority
      ) {
        largest = leftChild;
      }

      if (
        rightChild < length &&
        this.heap[rightChild]!.priority > this.heap[largest]!.priority
      ) {
        largest = rightChild;
      }

      if (largest === index) break;

      [this.heap[index], this.heap[largest]] = [
        this.heap[largest]!,
        this.heap[index]!,
      ];
      index = largest;
    }
  }
}

/**
 * Fair Queue - Round-robin with priority classes
 */
export class FairQueue<T> {
  private queues: Map<number, T[]> = new Map();
  private priorities: number[] = [];
  private currentIndex = 0;

  /**
   * Get total size
   */
  get size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Check if empty
   */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Enqueue with priority class
   */
  enqueue(value: T, priority: number): void {
    if (!this.queues.has(priority)) {
      this.queues.set(priority, []);
      this.priorities = Array.from(this.queues.keys()).sort((a, b) => b - a);
    }
    this.queues.get(priority)!.push(value);
  }

  /**
   * Dequeue using round-robin across priority classes
   */
  dequeue(): T | undefined {
    if (this.isEmpty) return undefined;

    // Find next non-empty queue
    const startIndex = this.currentIndex;
    do {
      const priority = this.priorities[this.currentIndex];
      if (priority !== undefined) {
        const queue = this.queues.get(priority)!;
        if (queue.length > 0) {
          this.currentIndex = (this.currentIndex + 1) % this.priorities.length;
          return queue.shift();
        }
      }
      this.currentIndex = (this.currentIndex + 1) % this.priorities.length;
    } while (this.currentIndex !== startIndex);

    return undefined;
  }

  /**
   * Dequeue from highest priority only
   */
  dequeueHighest(): T | undefined {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues.clear();
    this.priorities = [];
    this.currentIndex = 0;
  }
}

/**
 * Delay Queue - Items become available after a delay
 */
export class DelayQueue<T> {
  private items: Array<{ value: T; availableAt: number }> = [];

  /**
   * Get size
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * Get available count
   */
  get availableCount(): number {
    const now = Date.now();
    return this.items.filter((item) => item.availableAt <= now).length;
  }

  /**
   * Enqueue with delay
   */
  enqueue(value: T, delayMs: number): void {
    const availableAt = Date.now() + delayMs;
    this.items.push({ value, availableAt });
    this.items.sort((a, b) => a.availableAt - b.availableAt);
  }

  /**
   * Enqueue with specific available time
   */
  enqueueAt(value: T, availableAt: number): void {
    this.items.push({ value, availableAt });
    this.items.sort((a, b) => a.availableAt - b.availableAt);
  }

  /**
   * Dequeue if available
   */
  dequeue(): T | undefined {
    const now = Date.now();
    if (this.items.length > 0 && this.items[0]!.availableAt <= now) {
      return this.items.shift()!.value;
    }
    return undefined;
  }

  /**
   * Peek at next available item
   */
  peek(): T | undefined {
    const now = Date.now();
    if (this.items.length > 0 && this.items[0]!.availableAt <= now) {
      return this.items[0]!.value;
    }
    return undefined;
  }

  /**
   * Get time until next item is available
   */
  timeUntilNext(): number | undefined {
    if (this.items.length === 0) return undefined;
    return Math.max(0, this.items[0]!.availableAt - Date.now());
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.items = [];
  }
}

/**
 * Bounded Queue - Fixed capacity with overflow handling
 */
export class BoundedQueue<T> {
  private items: T[] = [];
  private capacity: number;
  private overflowPolicy: 'drop-oldest' | 'drop-newest' | 'reject';

  constructor(
    capacity: number,
    overflowPolicy: 'drop-oldest' | 'drop-newest' | 'reject' = 'drop-oldest'
  ) {
    this.capacity = capacity;
    this.overflowPolicy = overflowPolicy;
  }

  get size(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Enqueue item with overflow handling
   */
  enqueue(value: T): boolean {
    if (this.isFull) {
      switch (this.overflowPolicy) {
        case 'drop-oldest':
          this.items.shift();
          break;
        case 'drop-newest':
          return false;
        case 'reject':
          throw new Error('Queue is full');
      }
    }
    this.items.push(value);
    return true;
  }

  /**
   * Dequeue item
   */
  dequeue(): T | undefined {
    return this.items.shift();
  }

  /**
   * Peek at front
   */
  peek(): T | undefined {
    return this.items[0];
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.items = [];
  }
}
