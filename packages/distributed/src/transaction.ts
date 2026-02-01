/**
 * Distributed Transactions
 * Two-phase commit for ISL distributed operations
 */

import {
  DistributedTransaction,
  TransactionParticipant,
  TransactionStatus,
} from './types';

/**
 * Transaction coordinator
 */
export class TransactionCoordinator {
  private transactions: Map<string, DistributedTransaction> = new Map();
  private participants: Map<string, TransactionResource> = new Map();

  constructor(private nodeId: string) {}

  /**
   * Register a transaction resource
   */
  registerResource(name: string, resource: TransactionResource): void {
    this.participants.set(name, resource);
  }

  /**
   * Begin a new distributed transaction
   */
  async begin(resources: string[], timeout: number = 30000): Promise<string> {
    const txId = this.generateTxId();

    const participants: TransactionParticipant[] = resources.map((resource) => ({
      nodeId: this.nodeId,
      resource,
      status: 'pending',
    }));

    const transaction: DistributedTransaction = {
      id: txId,
      participants,
      status: 'preparing',
      startedAt: Date.now(),
      timeout,
      coordinator: this.nodeId,
    };

    this.transactions.set(txId, transaction);

    return txId;
  }

  /**
   * Prepare phase - ask all participants to prepare
   */
  async prepare(txId: string): Promise<boolean> {
    const tx = this.transactions.get(txId);
    if (!tx) throw new TransactionError(`Transaction ${txId} not found`);

    const preparePromises = tx.participants.map(async (participant) => {
      const resource = this.participants.get(participant.resource);
      if (!resource) {
        participant.status = 'failed';
        participant.vote = 'abort';
        return false;
      }

      try {
        const canCommit = await resource.prepare(txId);
        participant.vote = canCommit ? 'commit' : 'abort';
        participant.status = canCommit ? 'prepared' : 'failed';
        return canCommit;
      } catch {
        participant.status = 'failed';
        participant.vote = 'abort';
        return false;
      }
    });

    const results = await Promise.all(preparePromises);
    const allPrepared = results.every((r) => r);

    tx.status = allPrepared ? 'prepared' : 'aborting';
    return allPrepared;
  }

  /**
   * Commit phase - commit all participants
   */
  async commit(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) throw new TransactionError(`Transaction ${txId} not found`);

    if (tx.status !== 'prepared') {
      throw new TransactionError(`Transaction ${txId} is not prepared`);
    }

    tx.status = 'committing';

    const commitPromises = tx.participants.map(async (participant) => {
      if (participant.status !== 'prepared') return;

      const resource = this.participants.get(participant.resource);
      if (!resource) return;

      try {
        await resource.commit(txId);
        participant.status = 'committed';
      } catch {
        participant.status = 'failed';
        // In production, need recovery mechanism
      }
    });

    await Promise.all(commitPromises);
    tx.status = 'committed';
  }

  /**
   * Abort transaction
   */
  async abort(txId: string): Promise<void> {
    const tx = this.transactions.get(txId);
    if (!tx) throw new TransactionError(`Transaction ${txId} not found`);

    tx.status = 'aborting';

    const abortPromises = tx.participants.map(async (participant) => {
      if (participant.status === 'committed') return; // Can't abort committed

      const resource = this.participants.get(participant.resource);
      if (!resource) return;

      try {
        await resource.abort(txId);
        participant.status = 'aborted';
      } catch {
        participant.status = 'failed';
      }
    });

    await Promise.all(abortPromises);
    tx.status = 'aborted';
  }

  /**
   * Execute a complete transaction
   */
  async execute<T>(
    resources: string[],
    work: (context: TransactionContext) => Promise<T>
  ): Promise<T> {
    const txId = await this.begin(resources);
    const context: TransactionContext = {
      txId,
      getResource: (name) => this.participants.get(name),
    };

    try {
      const result = await work(context);
      const prepared = await this.prepare(txId);

      if (prepared) {
        await this.commit(txId);
        return result;
      } else {
        await this.abort(txId);
        throw new TransactionError('Transaction aborted during prepare');
      }
    } catch (error) {
      await this.abort(txId);
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  getStatus(txId: string): DistributedTransaction | undefined {
    return this.transactions.get(txId);
  }

  private generateTxId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Transaction resource interface
 */
export interface TransactionResource {
  prepare(txId: string): Promise<boolean>;
  commit(txId: string): Promise<void>;
  abort(txId: string): Promise<void>;
}

/**
 * Transaction context passed to work function
 */
export interface TransactionContext {
  txId: string;
  getResource(name: string): TransactionResource | undefined;
}

/**
 * Transaction error
 */
export class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Abstract transaction resource
 */
export abstract class AbstractTransactionResource implements TransactionResource {
  protected pendingOperations: Map<string, unknown[]> = new Map();

  async prepare(txId: string): Promise<boolean> {
    // Validate all pending operations can be committed
    const operations = this.pendingOperations.get(txId) ?? [];
    return this.canCommit(operations);
  }

  async commit(txId: string): Promise<void> {
    const operations = this.pendingOperations.get(txId) ?? [];
    await this.applyOperations(operations);
    this.pendingOperations.delete(txId);
  }

  async abort(txId: string): Promise<void> {
    this.pendingOperations.delete(txId);
  }

  /**
   * Add operation to pending list
   */
  addOperation(txId: string, operation: unknown): void {
    if (!this.pendingOperations.has(txId)) {
      this.pendingOperations.set(txId, []);
    }
    this.pendingOperations.get(txId)!.push(operation);
  }

  protected abstract canCommit(operations: unknown[]): Promise<boolean>;
  protected abstract applyOperations(operations: unknown[]): Promise<void>;
}

/**
 * Create transaction coordinator
 */
export function createTransactionCoordinator(nodeId: string): TransactionCoordinator {
  return new TransactionCoordinator(nodeId);
}
