// ============================================================================
// Mock Server Generator Types
// ============================================================================

export type MockFramework = 'msw' | 'express' | 'fastify' | 'json-server';

export type DataStrategy = 'faker' | 'static' | 'scenario-based';

export interface GenerateOptions {
  /** Target mock framework */
  framework: MockFramework;
  /** Data generation strategy */
  dataStrategy?: DataStrategy;
  /** Port for the mock server */
  port?: number;
  /** Base path for API endpoints */
  basePath?: string;
  /** Include delay simulation */
  includeDelay?: boolean;
  /** Delay range in ms */
  delayRange?: [number, number];
  /** Include error simulation */
  includeErrorSimulation?: boolean;
  /** Error probability (0-1) */
  errorProbability?: number;
  /** Persistence mode (in-memory) */
  persistence?: boolean;
  /** Generate handlers for each behavior */
  generateHandlers?: boolean;
  /** Use scenarios for test data */
  useScenarios?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'handler' | 'server' | 'factory' | 'config' | 'data';
}

export interface MockEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  behaviorName: string;
  inputType?: string;
  outputType: string;
  errors: MockError[];
}

export interface MockError {
  name: string;
  statusCode: number;
  probability?: number;
}

export interface DataFactory {
  entityName: string;
  fields: FieldGenerator[];
}

export interface FieldGenerator {
  name: string;
  generator: string;
  constraints?: Record<string, unknown>;
}
