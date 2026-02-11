// ============================================================================
// Observability Standard Library - Metrics Tests
// @isl-lang/stdlib-observability
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsRegistry,
  MetricType,
  MetricUnit,
  ConsoleMetricExporter,
  InMemoryMetricExporter,
  getDefaultRegistry,
  setDefaultRegistry,
} from '../implementations/typescript/metrics';

describe('Metrics', () => {
  let registry: MetricsRegistry;
  let memoryExporter: InMemoryMetricExporter;

  beforeEach(() => {
    memoryExporter = new InMemoryMetricExporter();
    registry = new MetricsRegistry({
      exporter: memoryExporter,
    });
  });

  describe('Counter', () => {
    it('should increment counter values', async () => {
      const counter = registry.registerCounter({
        name: 'requests_total',
        description: 'Total number of requests',
        unit: MetricUnit.COUNT,
      });

      await counter.increment();
      await counter.increment(5);
      await counter.increment(3, { method: 'GET' });

      await registry.collect();

      const samples = memoryExporter.getSamples();
      expect(samples).toHaveLength(3); // One for each label combination
      
      const baseCounter = samples.find(s => !s.labels);
      expect(baseCounter?.value).toBe(6);
      
      const getCounter = samples.find(s => s.labels?.method === 'GET');
      expect(getCounter?.value).toBe(3);
    });

    it('should reject negative values', async () => {
      const counter = registry.registerCounter({
        name: 'test_counter',
        description: 'Test counter',
      });

      await expect(counter.increment(-1)).rejects.toThrow('Counter value must be non-negative');
    });
  });

  describe('Gauge', () => {
    it('should set gauge values', async () => {
      const gauge = registry.registerGauge({
        name: 'temperature_celsius',
        description: 'Current temperature',
        unit: MetricUnit.COUNT,
      });

      await gauge.set(23.5);
      await gauge.set(18.2, { location: 'room1' });

      await registry.collect();

      const samples = memoryExporter.getSamples();
      expect(samples).toHaveLength(2);
      
      const baseGauge = samples.find(s => !s.labels);
      expect(baseGauge?.value).toBe(23.5);
      
      const roomGauge = samples.find(s => s.labels?.location === 'room1');
      expect(roomGauge?.value).toBe(18.2);
    });
  });

  describe('Histogram', () => {
    it('should observe values and calculate buckets', async () => {
      const histogram = registry.registerHistogram({
        name: 'request_duration_seconds',
        description: 'Request duration',
        unit: MetricUnit.SECONDS,
        buckets: [0.1, 0.5, 1.0, 2.0, 5.0],
      });

      await histogram.observe(0.05);
      await histogram.observe(0.3);
      await histogram.observe(0.7);
      await histogram.observe(1.5);
      await histogram.observe(3.0);

      await registry.collect();

      const samples = memoryExporter.getSamples();
      
      // Check bucket counts
      const bucket0_1 = samples.find(s => s.name === 'request_duration_seconds_bucket' && s.labels?.le === '0.1');
      expect(bucket0_1?.value).toBe(1);

      const bucket0_5 = samples.find(s => s.name === 'request_duration_seconds_bucket' && s.labels?.le === '0.5');
      expect(bucket0_5?.value).toBe(2);

      const bucket5_0 = samples.find(s => s.name === 'request_duration_seconds_bucket' && s.labels?.le === '5.0');
      expect(bucket5_0?.value).toBe(5);

      // Check count and sum
      const count = samples.find(s => s.name === 'request_duration_seconds_count');
      expect(count?.value).toBe(5);

      const sum = samples.find(s => s.name === 'request_duration_seconds_sum');
      expect(sum?.value).toBe(5.55);
    });

    it('should use default buckets if not specified', async () => {
      const histogram = registry.registerHistogram({
        name: 'test_histogram',
        description: 'Test histogram',
      });

      await histogram.observe(0.005);
      await histogram.observe(0.05);
      await histogram.observe(0.5);
      await histogram.observe(5.0);
      await histogram.observe(50.0);

      await registry.collect();

      const samples = memoryExporter.getSamples();
      const bucketSamples = samples.filter(s => s.name === 'test_histogram_bucket');
      expect(bucketSamples.length).toBeGreaterThan(0);
    });
  });

  describe('Summary', () => {
    it('should track quantiles', async () => {
      const summary = registry.registerSummary({
        name: 'request_size_bytes',
        description: 'Request size',
        unit: MetricUnit.BYTES,
        objectives: new Map([
          [0.5, 0.05],
          [0.9, 0.01],
          [0.99, 0.001],
        ]),
        maxAge: 60000, // 1 minute
      });

      // Simulate observations
      for (let i = 0; i < 100; i++) {
        await summary.observe(i);
      }

      await registry.collect();

      const samples = memoryExporter.getSamples();
      
      // Check quantiles
      const quantile50 = samples.find(s => s.name === 'request_size_bytes' && s.labels?.quantile === '0.5');
      expect(quantile50?.value).toBeCloseTo(49, 0);

      const quantile90 = samples.find(s => s.name === 'request_size_bytes' && s.labels?.quantile === '0.9');
      expect(quantile90?.value).toBeCloseTo(89, 0);

      const quantile99 = samples.find(s => s.name === 'request_size_bytes' && s.labels?.quantile === '0.99');
      expect(quantile99?.value).toBeCloseTo(98, 0);

      // Check count and sum
      const count = samples.find(s => s.name === 'request_size_bytes_count');
      expect(count?.value).toBe(100);

      const sum = samples.find(s => s.name === 'request_size_bytes_sum');
      expect(sum?.value).toBe(4950); // Sum of 0 to 99
    });
  });

  describe('Timing', () => {
    it('should record timing measurements', async () => {
      const histogram = registry.registerHistogram({
        name: 'operation_duration_seconds',
        description: 'Operation duration',
        unit: MetricUnit.SECONDS,
      });

      const start = new Date();
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      const end = new Date();

      await histogram.recordTiming(start, end);

      await registry.collect();

      const samples = memoryExporter.getSamples();
      const sum = samples.find(s => s.name === 'operation_duration_seconds_sum');
      expect(sum?.value).toBeGreaterThan(0);
    });

    it('should use current time if end time not provided', async () => {
      const histogram = registry.registerHistogram({
        name: 'auto_timing',
        description: 'Auto timing',
      });

      const start = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await histogram.recordTiming(start);
      expect(result.durationMs).toBeGreaterThan(0);
    });
  });

  describe('Registry', () => {
    it('should prevent duplicate metric names', () => {
      registry.registerCounter({
        name: 'test_metric',
        description: 'Test metric',
      });

      expect(() => {
        registry.registerGauge({
          name: 'test_metric',
          description: 'Another test metric',
        });
      }).toThrow('Metric "test_metric" already registered');
    });

    it('should get registered metrics', () => {
      const counter = registry.registerCounter({
        name: 'test_counter',
        description: 'Test counter',
      });

      const retrieved = registry.getMetric('test_counter');
      expect(retrieved).toBe(counter);

      expect(registry.getMetric('nonexistent')).toBeUndefined();
    });

    it('should clear all metrics', async () => {
      registry.registerCounter({ name: 'counter1', description: 'Test 1' });
      registry.registerGauge({ name: 'gauge1', description: 'Test 2' });

      expect(registry.getMetricNames()).toHaveLength(2);

      registry.clear();
      expect(registry.getMetricNames()).toHaveLength(0);
    });
  });

  describe('Default Registry', () => {
    it('should manage default registry instance', () => {
      const originalRegistry = getDefaultRegistry();
      
      const newRegistry = new MetricsRegistry({
        exporter: new ConsoleMetricExporter(),
      });

      setDefaultRegistry(newRegistry);
      expect(getDefaultRegistry()).toBe(newRegistry);

      // Restore original
      setDefaultRegistry(originalRegistry);
    });
  });

  describe('Metric Math', () => {
    it('should handle floating point precision', async () => {
      const gauge = registry.registerGauge({
        name: 'precision_test',
        description: 'Precision test',
      });

      await gauge.set(0.1 + 0.2); // Should be 0.30000000000000004
      await gauge.set(Number.MAX_SAFE_INTEGER);
      await gauge.set(Number.MIN_VALUE);

      await registry.collect();

      const samples = memoryExporter.getSamples();
      expect(samples).toHaveLength(3);
      expect(samples[0].value).toBeCloseTo(0.3, 10);
      expect(samples[1].value).toBe(Number.MAX_SAFE_INTEGER);
      expect(samples[2].value).toBe(Number.MIN_VALUE);
    });
  });
});
