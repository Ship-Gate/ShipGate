/**
 * Latency Panels
 * 
 * Panels for displaying latency metrics and distributions.
 */

import type { Panel } from '../types.js';

export interface LatencyPanelOptions {
  domain: string;
  behavior?: string;
}

/**
 * Response time distribution heatmap
 */
export function createLatencyHeatmapPanel(options: LatencyPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Response Time Distribution',
    type: 'heatmap',
    targets: [{
      expr: `sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le)`,
      legendFormat: '{{le}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        custom: {
          hideFrom: {
            legend: false,
            tooltip: false,
            viz: false,
          },
        },
      },
    },
    options: {
      calculate: false,
      cellGap: 1,
      color: {
        mode: 'scheme',
        scheme: 'Spectral',
        steps: 64,
      },
      exemplars: {
        color: 'rgba(255,0,255,0.7)',
      },
      filterValues: {
        le: 1e-9,
      },
      legend: {
        show: true,
      },
      rowsFrame: {
        layout: 'auto',
      },
      showValue: 'never',
      tooltip: {
        show: true,
        yHistogram: false,
      },
      yAxis: {
        axisPlacement: 'left',
        reverse: false,
        unit: 's',
      },
    },
  };
}

/**
 * P99 latency timeseries
 */
export function createP99LatencyPanel(options: LatencyPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'P99 Latency',
    type: 'timeseries',
    targets: [{
      expr: `histogram_quantile(0.99, sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le, behavior))`,
      legendFormat: '{{behavior}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 's',
        custom: {
          lineWidth: 2,
          fillOpacity: 10,
          gradientMode: 'none',
          showPoints: 'never',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'green' },
            { value: 0.5, color: 'yellow' },
            { value: 1, color: 'red' },
          ],
        },
      },
    },
    options: {
      legend: {
        displayMode: 'table',
        placement: 'right',
        showLegend: true,
        calcs: ['lastNotNull', 'max'],
      },
      tooltip: {
        mode: 'multi',
        sort: 'desc',
      },
    },
  };
}

/**
 * P50 latency timeseries
 */
export function createP50LatencyPanel(options: LatencyPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'P50 Latency',
    type: 'timeseries',
    targets: [{
      expr: `histogram_quantile(0.50, sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le, behavior))`,
      legendFormat: '{{behavior}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 's',
        custom: {
          lineWidth: 2,
          fillOpacity: 10,
          gradientMode: 'none',
          showPoints: 'never',
        },
      },
    },
    options: {
      legend: {
        displayMode: 'list',
        placement: 'bottom',
        showLegend: true,
      },
      tooltip: {
        mode: 'multi',
        sort: 'desc',
      },
    },
  };
}

/**
 * Latency percentiles stat panels
 */
export function createLatencyPercentilesPanel(options: LatencyPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Current Latency',
    type: 'stat',
    targets: [
      {
        expr: `histogram_quantile(0.50, sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le))`,
        legendFormat: 'P50',
        refId: 'A',
      },
      {
        expr: `histogram_quantile(0.95, sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le))`,
        legendFormat: 'P95',
        refId: 'B',
      },
      {
        expr: `histogram_quantile(0.99, sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}'}[5m])) by (le))`,
        legendFormat: 'P99',
        refId: 'C',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 's',
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'green' },
            { value: 0.2, color: 'yellow' },
            { value: 0.5, color: 'red' },
          ],
        },
      },
    },
    options: {
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
      colorMode: 'value',
      orientation: 'horizontal',
    },
  };
}

/**
 * SLA compliance panel
 */
export function createSLACompliancePanel(options: LatencyPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'SLA Compliance',
    type: 'gauge',
    targets: [{
      expr: `sum(rate(isl_implementation_latency_seconds_bucket{domain='${domain}',le='0.5'}[1h])) / sum(rate(isl_implementation_latency_seconds_count{domain='${domain}'}[1h])) * 100`,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percent',
        min: 0,
        max: 100,
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'red' },
            { value: 95, color: 'yellow' },
            { value: 99, color: 'green' },
          ],
        },
      },
    },
    options: {
      showThresholdLabels: true,
      showThresholdMarkers: true,
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
    },
    description: 'Percentage of requests under 500ms SLA',
  };
}
