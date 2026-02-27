import { describe, it, expect } from 'vitest';
import {
  jaegerConfigFromEnv,
  zipkinConfigFromEnv,
  otlpConfigFromEnv,
  OTLPBackends,
  ZipkinURLs,
  defaultJaegerConfig,
  defaultZipkinConfig,
  defaultOTLPConfig,
} from '../src';

describe('Jaeger Exporter', () => {
  it('should have correct default config', () => {
    expect(defaultJaegerConfig.endpoint).toBe('http://localhost:14268/api/traces');
    expect(defaultJaegerConfig.useBatch).toBe(true);
    expect(defaultJaegerConfig.batchOptions?.maxQueueSize).toBe(2048);
  });

  it('should create config from environment', () => {
    const config = jaegerConfigFromEnv();

    expect(config.serviceName).toBeDefined();
    expect(config.endpoint).toBeDefined();
    expect(typeof config.useBatch).toBe('boolean');
  });
});

describe('Zipkin Exporter', () => {
  it('should have correct default config', () => {
    expect(defaultZipkinConfig.url).toBe('http://localhost:9411/api/v2/spans');
    expect(defaultZipkinConfig.useBatch).toBe(true);
  });

  it('should create config from environment', () => {
    const config = zipkinConfigFromEnv();

    expect(config.serviceName).toBeDefined();
    expect(config.url).toBeDefined();
  });

  describe('ZipkinURLs', () => {
    const baseUrl = 'http://localhost:9411';

    it('should build traces URL', () => {
      expect(ZipkinURLs.traces(baseUrl)).toBe('http://localhost:9411/api/v2/spans');
    });

    it('should build services URL', () => {
      expect(ZipkinURLs.services(baseUrl)).toBe('http://localhost:9411/api/v2/services');
    });

    it('should build trace UI URL', () => {
      expect(ZipkinURLs.traceUI(baseUrl, 'abc123')).toBe(
        'http://localhost:9411/zipkin/traces/abc123'
      );
    });
  });
});

describe('OTLP Exporter', () => {
  it('should have correct default config', () => {
    expect(defaultOTLPConfig.endpoint).toBe('http://localhost:4318');
    expect(defaultOTLPConfig.protocol).toBe('http');
    expect(defaultOTLPConfig.useBatch).toBe(true);
    expect(defaultOTLPConfig.metricExportIntervalMs).toBe(60000);
  });

  it('should create config from environment', () => {
    const config = otlpConfigFromEnv();

    expect(config.serviceName).toBeDefined();
    expect(config.endpoint).toBeDefined();
    expect(config.protocol).toBe('http');
  });

  describe('OTLPBackends', () => {
    it('should generate local config', () => {
      const config = OTLPBackends.local();

      expect(config.endpoint).toBe('http://localhost:4318');
      expect(config.protocol).toBe('http');
    });

    it('should generate Grafana Cloud config', () => {
      const config = OTLPBackends.grafanaCloud('123456', 'api-key');

      expect(config.endpoint).toContain('grafana.net');
      expect(config.headers?.Authorization).toContain('Basic');
    });

    it('should generate Honeycomb config', () => {
      const config = OTLPBackends.honeycomb('api-key', 'my-dataset');

      expect(config.endpoint).toBe('https://api.honeycomb.io');
      expect(config.headers?.['x-honeycomb-team']).toBe('api-key');
      expect(config.headers?.['x-honeycomb-dataset']).toBe('my-dataset');
    });

    it('should generate Datadog config', () => {
      const config = OTLPBackends.datadog('api-key');

      expect(config.endpoint).toContain('datadoghq.com');
      expect(config.headers?.['DD-API-KEY']).toBe('api-key');
    });

    it('should generate New Relic config', () => {
      const usConfig = OTLPBackends.newRelic('api-key', 'us');
      const euConfig = OTLPBackends.newRelic('api-key', 'eu');

      expect(usConfig.endpoint).toBe('https://otlp.nr-data.net');
      expect(euConfig.endpoint).toBe('https://otlp.eu01.nr-data.net');
      expect(usConfig.headers?.['api-key']).toBe('api-key');
    });
  });
});
