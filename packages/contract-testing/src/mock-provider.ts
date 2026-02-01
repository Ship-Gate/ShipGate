/**
 * Mock Provider
 *
 * Create mock providers for consumer testing.
 */

import express, { Express, Request, Response } from 'express';
import { Contract, Interaction } from './types.js';

export interface MockProviderOptions {
  /** Port to run on */
  port?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

export class MockProvider {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;
  private contract: Contract;
  private options: Required<MockProviderOptions>;
  private interactions: Map<string, Interaction>;
  private callHistory: Array<{
    interactionId: string;
    request: { method: string; path: string; body: unknown };
    timestamp: string;
  }>;

  constructor(contract: Contract, options: MockProviderOptions = {}) {
    this.contract = contract;
    this.options = {
      port: options.port ?? 0, // Random port
      verbose: options.verbose ?? false,
    };
    this.app = express();
    this.interactions = new Map();
    this.callHistory = [];

    this.setupMiddleware();
    this.setupInteractions();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    if (this.options.verbose) {
      this.app.use((req, _res, next) => {
        console.log(`[MockProvider] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  private setupInteractions(): void {
    for (const interaction of this.contract.interactions) {
      const key = `${interaction.request.method}:${interaction.request.path}`;
      this.interactions.set(key, interaction);

      const handler = this.createHandler(interaction);
      
      switch (interaction.request.method) {
        case 'GET':
          this.app.get(interaction.request.path, handler);
          break;
        case 'POST':
          this.app.post(interaction.request.path, handler);
          break;
        case 'PUT':
          this.app.put(interaction.request.path, handler);
          break;
        case 'PATCH':
          this.app.patch(interaction.request.path, handler);
          break;
        case 'DELETE':
          this.app.delete(interaction.request.path, handler);
          break;
      }
    }

    // 404 for unknown routes
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'No matching interaction found' });
    });
  }

  private createHandler(interaction: Interaction): (req: Request, res: Response) => void {
    return (req: Request, res: Response) => {
      // Record the call
      this.callHistory.push({
        interactionId: interaction.id,
        request: {
          method: req.method,
          path: req.path,
          body: req.body,
        },
        timestamp: new Date().toISOString(),
      });

      // Set response headers
      if (interaction.response.headers) {
        for (const [key, value] of Object.entries(interaction.response.headers)) {
          res.setHeader(key, value);
        }
      }

      // Send response
      res.status(interaction.response.status).json(interaction.response.body);
    };
  }

  /**
   * Start the mock provider
   */
  async start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        const address = this.server!.address() as { port: number };
        const baseUrl = `http://localhost:${address.port}`;
        
        if (this.options.verbose) {
          console.log(`[MockProvider] Started at ${baseUrl}`);
          console.log(`[MockProvider] Interactions:`);
          for (const interaction of this.contract.interactions) {
            console.log(`  ${interaction.request.method} ${interaction.request.path} → ${interaction.response.status}`);
          }
        }
        
        resolve(baseUrl);
      });
    });
  }

  /**
   * Stop the mock provider
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get call history
   */
  getCallHistory(): typeof this.callHistory {
    return [...this.callHistory];
  }

  /**
   * Clear call history
   */
  clearHistory(): void {
    this.callHistory = [];
  }

  /**
   * Verify all expected interactions were called
   */
  verify(): { passed: boolean; missing: string[]; unexpected: string[] } {
    const calledIds = new Set(this.callHistory.map((c) => c.interactionId));
    const expectedIds = new Set(this.contract.interactions.map((i) => i.id));

    const missing = Array.from(expectedIds).filter((id) => !calledIds.has(id));
    const unexpected = Array.from(calledIds).filter((id) => !expectedIds.has(id));

    return {
      passed: missing.length === 0,
      missing,
      unexpected,
    };
  }

  /**
   * Get the Express app for custom configuration
   */
  getApp(): Express {
    return this.app;
  }
}

/**
 * Create and start a mock provider
 */
export async function createMockProvider(
  contract: Contract,
  options?: MockProviderOptions
): Promise<{ provider: MockProvider; baseUrl: string }> {
  const provider = new MockProvider(contract, options);
  const baseUrl = await provider.start();
  return { provider, baseUrl };
}
