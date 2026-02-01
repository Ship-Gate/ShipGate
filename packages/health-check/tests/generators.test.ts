/**
 * Health Check Generators Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KubernetesProbeGenerator,
  createKubernetesProbes,
  livenessProbe,
  readinessProbe,
  generateProbeYaml,
} from '../src/generators/kubernetes.js';
import {
  ExpressHealthGenerator,
  healthMiddleware,
} from '../src/generators/express.js';
import type { HealthCheckConfig, CheckResult } from '../src/types.js';

// Mock Express types
interface MockRequest {
  ip?: string;
  socket: { remoteAddress?: string };
  method: string;
}

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (body: unknown) => void;
  setHeader: (key: string, value: string) => void;
  end: () => void;
  send: (body: string) => void;
}

const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
  method: 'GET',
  ...overrides,
});

const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
    send: vi.fn(),
  };
  return res;
};

// Mock health checks
const healthyResult: CheckResult = {
  status: 'healthy',
  latency: 10,
  timestamp: Date.now(),
};

const unhealthyResult: CheckResult = {
  status: 'unhealthy',
  message: 'Connection failed',
  timestamp: Date.now(),
};

const createMockCheck = (
  name: string,
  result: CheckResult,
  critical: boolean = false
): HealthCheckConfig => ({
  name,
  critical,
  check: vi.fn().mockResolvedValue(result),
});

describe('KubernetesProbeGenerator', () => {
  let generator: KubernetesProbeGenerator;

  beforeEach(() => {
    generator = new KubernetesProbeGenerator(
      [
        createMockCheck('db', healthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ],
      {
        version: '1.0.0',
        serviceName: 'test-service',
      }
    );
  });

  describe('handleLiveness', () => {
    it('should return 200 when process is alive', async () => {
      const handlers = generator.getHandlers();
      const response = await handlers.liveness();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('handleReadiness', () => {
    it('should return 200 when all critical checks pass', async () => {
      const handlers = generator.getHandlers();
      const response = await handlers.readiness();

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should return 503 when critical check fails', async () => {
      const failingGenerator = new KubernetesProbeGenerator(
        [createMockCheck('db', unhealthyResult, true)],
        { version: '1.0.0', serviceName: 'test' }
      );

      const handlers = failingGenerator.getHandlers();
      const response = await handlers.readiness();

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('fail');
    });
  });

  describe('handleStartup', () => {
    it('should return startup handler when enabled', () => {
      const startupGenerator = new KubernetesProbeGenerator(
        [createMockCheck('db', healthyResult, true)],
        {
          version: '1.0.0',
          serviceName: 'test',
          includeStartupProbe: true,
        }
      );

      const handlers = startupGenerator.getHandlers();
      expect(handlers.startup).toBeDefined();
    });

    it('should mark startup complete after successful check', async () => {
      const startupGenerator = new KubernetesProbeGenerator(
        [createMockCheck('db', healthyResult, true)],
        {
          version: '1.0.0',
          serviceName: 'test',
          includeStartupProbe: true,
        }
      );

      const handlers = startupGenerator.getHandlers();
      const response = await handlers.startup!();

      expect(response.status).toBe(200);
    });
  });

  describe('getProbePaths', () => {
    it('should return default probe paths', () => {
      const paths = generator.getProbePaths();

      expect(paths.liveness).toBe('/health/live');
      expect(paths.readiness).toBe('/health/ready');
    });

    it('should return custom probe paths', () => {
      const customGenerator = new KubernetesProbeGenerator(
        [],
        {
          version: '1.0.0',
          serviceName: 'test',
          livenessPath: '/livez',
          readinessPath: '/readyz',
        }
      );

      const paths = customGenerator.getProbePaths();

      expect(paths.liveness).toBe('/livez');
      expect(paths.readiness).toBe('/readyz');
    });
  });

  describe('markStartupComplete', () => {
    it('should mark startup as complete', async () => {
      const startupGenerator = new KubernetesProbeGenerator(
        [createMockCheck('db', unhealthyResult, true)],
        {
          version: '1.0.0',
          serviceName: 'test',
          includeStartupProbe: true,
        }
      );

      startupGenerator.markStartupComplete();
      const handlers = startupGenerator.getHandlers();
      const response = await handlers.startup!();

      expect(response.status).toBe(200);
    });
  });
});

describe('createKubernetesProbes', () => {
  it('should create probe generator', () => {
    const generator = createKubernetesProbes(
      [createMockCheck('db', healthyResult)],
      { version: '1.0.0', serviceName: 'test' }
    );

    expect(generator).toBeInstanceOf(KubernetesProbeGenerator);
  });
});

describe('livenessProbe', () => {
  it('should create standalone liveness probe', async () => {
    const probe = livenessProbe();
    const response = await probe();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('readinessProbe', () => {
  it('should create standalone readiness probe', async () => {
    const probe = readinessProbe([createMockCheck('db', healthyResult, true)]);
    const response = await probe();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should return 503 when check fails', async () => {
    const probe = readinessProbe([createMockCheck('db', unhealthyResult, true)]);
    const response = await probe();

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('fail');
  });
});

describe('generateProbeYaml', () => {
  it('should generate Kubernetes probe YAML', () => {
    const yaml = generateProbeYaml(
      { liveness: '/health/live', readiness: '/health/ready' },
      { containerPort: 8080 }
    );

    expect(yaml).toContain('livenessProbe:');
    expect(yaml).toContain('readinessProbe:');
    expect(yaml).toContain('path: /health/live');
    expect(yaml).toContain('path: /health/ready');
    expect(yaml).toContain('port: 8080');
  });

  it('should include startup probe when provided', () => {
    const yaml = generateProbeYaml(
      { liveness: '/live', readiness: '/ready', startup: '/startup' },
      { containerPort: 8080 }
    );

    expect(yaml).toContain('startupProbe:');
    expect(yaml).toContain('path: /startup');
  });

  it('should use custom probe config', () => {
    const yaml = generateProbeYaml(
      { liveness: '/live', readiness: '/ready' },
      {
        containerPort: 3000,
        initialDelaySeconds: 30,
        periodSeconds: 15,
        timeoutSeconds: 10,
      }
    );

    expect(yaml).toContain('port: 3000');
    expect(yaml).toContain('initialDelaySeconds: 30');
    expect(yaml).toContain('periodSeconds: 15');
    expect(yaml).toContain('timeoutSeconds: 10');
  });
});

describe('ExpressHealthGenerator', () => {
  let generator: ExpressHealthGenerator;

  beforeEach(() => {
    generator = new ExpressHealthGenerator(
      [
        createMockCheck('db', healthyResult, true),
        createMockCheck('cache', healthyResult, false),
      ],
      {
        version: '1.0.0',
        serviceName: 'test-service',
      }
    );
  });

  describe('createMiddleware', () => {
    it('should create health middleware', async () => {
      const middleware = generator.createMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req as never, res as never, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          version: '1.0.0',
        })
      );
    });

    it('should set CORS headers when enabled', async () => {
      const corsGenerator = new ExpressHealthGenerator(
        [],
        { version: '1.0.0', serviceName: 'test', enableCors: true }
      );
      const middleware = corsGenerator.createMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req as never, res as never, vi.fn());

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
    });

    it('should handle OPTIONS request', async () => {
      const middleware = generator.createMiddleware();
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      await middleware(req as never, res as never, vi.fn());

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('createLivenessMiddleware', () => {
    it('should create liveness middleware', () => {
      const middleware = generator.createLivenessMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      middleware(req as never, res as never, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ok' })
      );
    });
  });

  describe('createReadinessMiddleware', () => {
    it('should create readiness middleware', async () => {
      const middleware = generator.createReadinessMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req as never, res as never, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 503 on failure', async () => {
      const failingGenerator = new ExpressHealthGenerator(
        [createMockCheck('db', unhealthyResult, true)],
        { version: '1.0.0', serviceName: 'test' }
      );
      const middleware = failingGenerator.createReadinessMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();

      await middleware(req as never, res as never, vi.fn());

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('getBasePath', () => {
    it('should return default base path', () => {
      expect(generator.getBasePath()).toBe('/health');
    });

    it('should return custom base path', () => {
      const customGenerator = new ExpressHealthGenerator(
        [],
        { version: '1.0.0', serviceName: 'test', basePath: '/api/health' }
      );

      expect(customGenerator.getBasePath()).toBe('/api/health');
    });
  });
});

describe('healthMiddleware', () => {
  it('should create middleware from array of checks', async () => {
    const middleware = healthMiddleware([
      createMockCheck('db', healthyResult),
    ]);
    const req = createMockRequest();
    const res = createMockResponse();

    await middleware(req as never, res as never, vi.fn());

    expect(res.json).toHaveBeenCalled();
  });

  it('should create middleware from object of checks', async () => {
    const middleware = healthMiddleware({
      database: createMockCheck('database', healthyResult),
      cache: createMockCheck('cache', healthyResult),
    });
    const req = createMockRequest();
    const res = createMockResponse();

    await middleware(req as never, res as never, vi.fn());

    expect(res.json).toHaveBeenCalled();
  });
});
