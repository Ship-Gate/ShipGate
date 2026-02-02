/**
 * Mock Server
 *
 * Express-based mock server that serves endpoints based on ISL specifications.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as fs from 'fs';
import { MockState } from './state.js';
import { ResponseGenerator } from './generators/response.js';
import { DataGenerator } from './generators/data.js';
import { ErrorGenerator } from './generators/error.js';
import { ScenarioManager, Scenario } from './scenarios.js';
import { RecordingManager, RecordingOptions } from './recording.js';

export interface BehaviorOverride {
  /** Static response to return */
  response?: unknown;
  /** Error to return */
  error?: string;
  /** Delay in milliseconds before responding */
  delay?: number;
  /** Condition to match for this override */
  when?: (input: unknown) => boolean;
  /** HTTP status code */
  status?: number;
  /** Custom handler */
  handler?: (req: Request, res: Response) => void | Promise<void>;
}

export interface MockServerOptions {
  /** Path to ISL domain file or parsed domain */
  domain: string | unknown;
  /** Port to run server on */
  port?: number;
  /** Base path for all routes */
  basePath?: string;
  /** Behavior overrides */
  overrides?: Record<string, BehaviorOverride | BehaviorOverride[]>;
  /** Initial state */
  initialState?: Record<string, unknown[]>;
  /** Enable recording mode */
  recording?: RecordingOptions;
  /** Active scenarios */
  scenarios?: Scenario[];
  /** CORS options */
  cors?: cors.CorsOptions | boolean;
  /** Enable request logging */
  logging?: boolean;
  /** Custom middleware */
  middleware?: express.RequestHandler[];
  /** Seed for random data generation */
  seed?: number;
  /** Latency simulation range [min, max] */
  latency?: [number, number];
}

export class MockServer {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;
  private options: Required<MockServerOptions>;
  private state: MockState;
  private responseGenerator: ResponseGenerator;
  private dataGenerator: DataGenerator;
  private _errorGenerator: ErrorGenerator;
  private scenarioManager: ScenarioManager;
  private recordingManager: RecordingManager;
  private domain: ParsedDomain;

  constructor(options: MockServerOptions) {
    this.options = {
      domain: options.domain,
      port: options.port ?? 3001,
      basePath: options.basePath ?? '/api',
      overrides: options.overrides ?? {},
      initialState: options.initialState ?? {},
      recording: options.recording ?? { enabled: false },
      scenarios: options.scenarios ?? [],
      cors: options.cors ?? true,
      logging: options.logging ?? true,
      middleware: options.middleware ?? [],
      seed: options.seed ?? Date.now(),
      latency: options.latency ?? [0, 0],
    };

    this.app = express();
    this.domain = this.loadDomain(options.domain);
    this.state = new MockState({ initialState: this.options.initialState });
    this.dataGenerator = new DataGenerator({ seed: this.options.seed });
    this.responseGenerator = new ResponseGenerator({
      dataGenerator: this.dataGenerator,
      state: this.state,
    });
    this._errorGenerator = new ErrorGenerator();
    this.scenarioManager = new ScenarioManager({ scenarios: this.options.scenarios });
    this.recordingManager = new RecordingManager(this.options.recording);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private loadDomain(domain: string | unknown): ParsedDomain {
    if (typeof domain === 'string') {
      // Load from file
      const content = fs.readFileSync(domain, 'utf-8');
      return this.parseISL(content);
    }
    return domain as ParsedDomain;
  }

  private parseISL(content: string): ParsedDomain {
    // Simple ISL parser for domain structure
    const domain: ParsedDomain = {
      name: '',
      entities: [],
      behaviors: [],
      types: [],
      enums: [],
    };

    // Extract domain name
    const domainMatch = content.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch?.[1]) {
      domain.name = domainMatch[1];
    }

    // Extract entities
    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(content)) !== null) {
      const name = entityMatch[1] ?? '';
      const body = entityMatch[2] ?? '';
      const fields = this.parseFields(body);
      domain.entities.push({ name, fields });
    }

    // Extract behaviors
    const behaviorRegex = /behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|type|invariants|\}))/g;
    let behaviorMatch;
    while ((behaviorMatch = behaviorRegex.exec(content)) !== null) {
      const name = behaviorMatch[1] ?? '';
      const body = behaviorMatch[2] ?? '';
      const behavior = this.parseBehavior(name, body);
      domain.behaviors.push(behavior);
    }

    // Extract enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(content)) !== null) {
      const name = enumMatch[1] ?? '';
      const body = enumMatch[2] ?? '';
      const values = body.match(/\b[A-Z][A-Z0-9_]+\b/g) ?? [];
      domain.enums.push({ name, values });
    }

    return domain;
  }

  private parseFields(body: string): ParsedField[] {
    const fields: ParsedField[] = [];
    const fieldRegex = /(\w+)\s*:\s*(\w+)(\?)?(?:\s*\[([^\]]+)\])?/g;
    let match;

    while ((match = fieldRegex.exec(body)) !== null) {
      fields.push({
        name: match[1] ?? '',
        type: match[2] ?? 'String',
        optional: match[3] === '?',
        annotations: match[4]?.split(',').map((a) => a.trim()) ?? [],
      });
    }

    return fields;
  }

  private parseBehavior(name: string, body: string): ParsedBehavior {
    const behavior: ParsedBehavior = {
      name,
      description: '',
      input: [],
      output: { success: 'Boolean', errors: [] },
    };

    // Extract description
    const descMatch = body.match(/description\s*:\s*"([^"]+)"/);
    if (descMatch?.[1]) {
      behavior.description = descMatch[1];
    }

    // Extract input
    const inputMatch = body.match(/input\s*\{([^}]+)\}/);
    if (inputMatch?.[1]) {
      behavior.input = this.parseFields(inputMatch[1]);
    }

    // Extract output
    const outputMatch = body.match(/output\s*\{([\s\S]*?)\n\s*\}/);
    if (outputMatch?.[1]) {
      const outputBody = outputMatch[1];

      // Success type
      const successMatch = outputBody.match(/success\s*:\s*(\w+)/);
      if (successMatch?.[1]) {
        behavior.output.success = successMatch[1];
      }

      // Errors
      const errorRegex = /(\w+)\s*\{[^}]*when\s*:\s*"([^"]+)"[^}]*\}/g;
      let errorMatch;
      while ((errorMatch = errorRegex.exec(outputBody)) !== null) {
        behavior.output.errors.push({
          name: errorMatch[1] ?? '',
          description: errorMatch[2] ?? '',
        });
      }
    }

    return behavior;
  }

  private setupMiddleware(): void {
    // CORS
    if (this.options.cors) {
      const corsOptions = typeof this.options.cors === 'object' ? this.options.cors : {};
      this.app.use(cors(corsOptions));
    }

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    if (this.options.logging) {
      this.app.use((req: Request, _res: Response, next: NextFunction) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${req.method} ${req.path}`);
        next();
      });
    }

    // Custom middleware
    for (const mw of this.options.middleware) {
      this.app.use(mw);
    }

    // Recording middleware
    if (this.options.recording.enabled) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
          this.recordingManager.record({
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            request: req.body,
            response: body,
            status: res.statusCode,
          });
          return originalJson(body);
        };
        next();
      });
    }

    // Latency simulation
    if (this.options.latency[0] > 0 || this.options.latency[1] > 0) {
      this.app.use(async (_req: Request, _res: Response, next: NextFunction) => {
        const [min, max] = this.options.latency;
        const delay = min + Math.random() * (max - min);
        await new Promise((resolve) => setTimeout(resolve, delay));
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get(`${this.options.basePath}/health`, (_req, res) => {
      res.json({ status: 'ok', domain: this.domain.name });
    });

    // List all behaviors
    this.app.get(`${this.options.basePath}/behaviors`, (_req, res) => {
      res.json({
        behaviors: this.domain.behaviors.map((b) => ({
          name: b.name,
          description: b.description,
          path: this.getBehaviorPath(b.name),
        })),
      });
    });

    // State management endpoints
    this.app.get(`${this.options.basePath}/_state`, (_req, res) => {
      res.json(this.state.getAll());
    });

    this.app.post(`${this.options.basePath}/_state/reset`, (_req, res) => {
      this.state.reset();
      res.json({ status: 'reset' });
    });

    this.app.post(`${this.options.basePath}/_state/:entity`, (req, res) => {
      const { entity } = req.params;
      this.state.set(entity, req.body);
      res.json({ status: 'updated', entity });
    });

    // Scenario management
    this.app.get(`${this.options.basePath}/_scenarios`, (_req, res) => {
      res.json({
        active: this.scenarioManager.getActiveScenario(),
        available: this.scenarioManager.listScenarios(),
      });
    });

    this.app.post(`${this.options.basePath}/_scenarios/:name`, (req, res) => {
      const { name } = req.params;
      try {
        this.scenarioManager.activateScenario(name);
        res.json({ status: 'activated', scenario: name });
      } catch (error) {
        res.status(404).json({ error: `Scenario '${name}' not found` });
      }
    });

    // Recording endpoints
    this.app.get(`${this.options.basePath}/_recordings`, (_req, res) => {
      res.json(this.recordingManager.getRecordings());
    });

    this.app.post(`${this.options.basePath}/_recordings/clear`, (_req, res) => {
      this.recordingManager.clear();
      res.json({ status: 'cleared' });
    });

    this.app.post(`${this.options.basePath}/_recordings/save`, async (req, res) => {
      const filename = req.body.filename ?? `recording-${Date.now()}.json`;
      await this.recordingManager.save(filename);
      res.json({ status: 'saved', filename });
    });

    // Generate routes for each behavior
    for (const behavior of this.domain.behaviors) {
      this.setupBehaviorRoute(behavior);
    }

    // Entity CRUD routes
    for (const entity of this.domain.entities) {
      this.setupEntityRoutes(entity);
    }
  }

  private getBehaviorPath(name: string): string {
    // Convert PascalCase to kebab-case
    const kebab = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    return `${this.options.basePath}/${this.domain.name.toLowerCase()}/${kebab}`;
  }

  private setupBehaviorRoute(behavior: ParsedBehavior): void {
    const routePath = this.getBehaviorPath(behavior.name);

    this.app.post(routePath, async (req: Request, res: Response): Promise<void> => {
      try {
        // Check for active scenario override
        const scenarioResponse = this.scenarioManager.getResponse(behavior.name, req.body);
        if (scenarioResponse !== undefined) {
          res.json(scenarioResponse);
          return;
        }

        // Check for behavior override
        const overrides = this.options.overrides[behavior.name];
        if (overrides) {
          const result = await this.applyOverride(overrides, req, res);
          if (result) return;
        }

        // Generate mock response
        const response = await this.generateResponse(behavior, req.body);
        res.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });
  }

  private async applyOverride(
    overrides: BehaviorOverride | BehaviorOverride[],
    req: Request,
    res: Response
  ): Promise<boolean> {
    const overrideList = Array.isArray(overrides) ? overrides : [overrides];

    for (const override of overrideList) {
      // Check condition
      if (override.when && !override.when(req.body)) {
        continue;
      }

      // Apply delay
      if (override.delay) {
        await new Promise((resolve) => setTimeout(resolve, override.delay));
      }

      // Custom handler
      if (override.handler) {
        await override.handler(req, res);
        return true;
      }

      // Error response
      if (override.error) {
        const status = override.status ?? 400;
        res.status(status).json({ error: override.error });
        return true;
      }

      // Static response
      if (override.response !== undefined) {
        res.json(override.response);
        return true;
      }
    }

    return false;
  }

  private async generateResponse(behavior: ParsedBehavior, input: unknown): Promise<unknown> {
    const successType = behavior.output.success;

    // Find the entity for this type
    const entity = this.domain.entities.find((e) => e.name === successType);

    if (entity) {
      // Generate entity data
      return this.responseGenerator.generateEntity(entity, input as Record<string, unknown>);
    }

    // Generate based on type
    return this.responseGenerator.generateType(successType);
  }

  private setupEntityRoutes(entity: ParsedEntity): void {
    const basePath = `${this.options.basePath}/${entity.name.toLowerCase()}s`;

    // List all
    this.app.get(basePath, (_req, res) => {
      const items = this.state.get(entity.name) ?? [];
      res.json({ items, count: items.length });
    });

    // Get by ID
    this.app.get(`${basePath}/:id`, (req, res) => {
      const item = this.state.findById(entity.name, req.params.id);
      if (item) {
        res.json(item);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    // Create
    this.app.post(basePath, (req, res) => {
      const item = this.responseGenerator.generateEntity(entity, req.body);
      this.state.add(entity.name, item);
      res.status(201).json(item);
    });

    // Update
    this.app.put(`${basePath}/:id`, (req, res) => {
      const updated = this.state.update(entity.name, req.params.id, req.body);
      if (updated) {
        res.json(updated);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    // Delete
    this.app.delete(`${basePath}/:id`, (req, res) => {
      const deleted = this.state.delete(entity.name, req.params.id);
      if (deleted) {
        res.json({ deleted: true });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        console.log(`\n🚀 Mock server running at http://localhost:${this.options.port}`);
        console.log(`   Domain: ${this.domain.name}`);
        console.log(`   Base path: ${this.options.basePath}`);
        console.log(`   Behaviors: ${this.domain.behaviors.length}`);
        console.log(`   Entities: ${this.domain.entities.length}\n`);

        console.log('Available endpoints:');
        for (const behavior of this.domain.behaviors) {
          console.log(`  POST ${this.getBehaviorPath(behavior.name)}`);
        }
        console.log();

        resolve();
      });
    });
  }

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

  getApp(): Express {
    return this.app;
  }

  getState(): MockState {
    return this.state;
  }

  getScenarioManager(): ScenarioManager {
    return this.scenarioManager;
  }

  getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  getErrorGenerator(): ErrorGenerator {
    return this._errorGenerator;
  }
}

/**
 * Create a mock server instance
 */
export async function createMockServer(options: MockServerOptions): Promise<MockServer> {
  return new MockServer(options);
}

// Internal types
interface ParsedDomain {
  name: string;
  entities: ParsedEntity[];
  behaviors: ParsedBehavior[];
  types: ParsedType[];
  enums: ParsedEnum[];
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
}

interface ParsedBehavior {
  name: string;
  description: string;
  input: ParsedField[];
  output: {
    success: string;
    errors: { name: string; description: string }[];
  };
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}

interface ParsedType {
  name: string;
  baseType: string;
}

interface ParsedEnum {
  name: string;
  values: string[];
}
