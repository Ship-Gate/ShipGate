/**
 * Metrics types
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricLabels {
  [key: string]: string;
}

export interface MetricSnapshot {
  name: string;
  type: MetricType;
  labels: MetricLabels;
  value: number;
  timestamp: number;
}

export interface HistogramSnapshot extends MetricSnapshot {
  type: 'histogram';
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: { le: number; count: number }[];
  percentiles: { p: number; value: number }[];
}

export interface CounterSnapshot extends MetricSnapshot {
  type: 'counter';
}

export interface GaugeSnapshot extends MetricSnapshot {
  type: 'gauge';
}
