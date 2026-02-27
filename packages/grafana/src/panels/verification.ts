/**
 * Verification Panels
 * 
 * Panels for displaying verification metrics and trends.
 */

import type { Panel, Target } from '../types.js';

export interface VerificationPanelOptions {
  domain: string;
  behavior?: string;
}

/**
 * Trust Score gauge panel
 */
export function createTrustScorePanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Trust Score',
    type: 'gauge',
    targets: [{
      expr: `isl_trust_score{domain='${domain}'}`,
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
            { value: 70, color: 'yellow' },
            { value: 85, color: 'green' },
            { value: 95, color: 'dark-green' },
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
  };
}

/**
 * Verification rate stat panel
 */
export function createVerificationRatePanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Verification Rate',
    type: 'stat',
    targets: [{
      expr: `sum(rate(isl_verification_total{domain='${domain}',verdict='verified'}[1h]))`,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'reqps',
        color: {
          mode: 'thresholds',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'green' },
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
    },
  };
}

/**
 * Failure rate stat panel
 */
export function createFailureRatePanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Failure Rate',
    type: 'stat',
    targets: [{
      expr: `sum(rate(isl_verification_total{domain='${domain}',verdict='unsafe'}[1h]))`,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'reqps',
        color: {
          mode: 'thresholds',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'green' },
            { value: 0.001, color: 'yellow' },
            { value: 0.01, color: 'red' },
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
    },
  };
}

/**
 * Verifications over time timeseries panel
 */
export function createVerificationsTimeseriesPanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Verifications Over Time',
    type: 'timeseries',
    targets: [{
      expr: `sum by (verdict) (rate(isl_verification_total{domain='${domain}'}[5m]))`,
      legendFormat: '{{verdict}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'reqps',
        custom: {
          lineWidth: 2,
          fillOpacity: 20,
          gradientMode: 'opacity',
          showPoints: 'never',
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'verified' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }],
        },
        {
          matcher: { id: 'byName', options: 'unsafe' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
        },
        {
          matcher: { id: 'byName', options: 'unknown' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'yellow' } }],
        },
      ],
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
 * Score trend timeseries panel
 */
export function createScoreTrendPanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Score Trend',
    type: 'timeseries',
    targets: [{
      expr: `avg(isl_verification_score{domain='${domain}'}) by (behavior)`,
      legendFormat: '{{behavior}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percent',
        min: 0,
        max: 100,
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
        displayMode: 'table',
        placement: 'right',
        showLegend: true,
        calcs: ['lastNotNull', 'min', 'max'],
      },
      tooltip: {
        mode: 'multi',
        sort: 'desc',
      },
    },
  };
}

/**
 * Verification results table panel
 */
export function createVerificationTablePanel(options: VerificationPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Recent Verifications',
    type: 'table',
    targets: [{
      expr: `isl_verification_total{domain='${domain}'}`,
      instant: true,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        custom: {
          align: 'auto',
          displayMode: 'auto',
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'verdict' },
          properties: [
            {
              id: 'custom.displayMode',
              value: 'color-background',
            },
            {
              id: 'mappings',
              value: [
                { type: 'value', options: { verified: { color: 'green', text: '✓ Verified' } } },
                { type: 'value', options: { unsafe: { color: 'red', text: '✗ Unsafe' } } },
                { type: 'value', options: { unknown: { color: 'yellow', text: '? Unknown' } } },
              ],
            },
          ],
        },
      ],
    },
  };
}
