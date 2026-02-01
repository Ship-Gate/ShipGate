/**
 * Alert Panels
 * 
 * Panels for displaying alerts and chaos testing results.
 */

import type { Panel } from '../types.js';

export interface AlertPanelOptions {
  domain: string;
}

/**
 * Active alerts list
 */
export function createAlertListPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  void domain; // Used for future filtering
  
  return {
    title: 'Active Alerts',
    type: 'alertlist',
    targets: [],
    options: {
      alertName: '',
      dashboardAlerts: true,
      groupMode: 'default',
      maxItems: 10,
      sortOrder: 1,
      stateFilter: {
        alerting: true,
        noData: true,
        pending: true,
        ok: false,
      },
    },
  };
}

/**
 * Chaos test results pie chart
 */
export function createChaosResultsPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Chaos Test Results',
    type: 'piechart',
    targets: [{
      expr: `sum by (result) (isl_chaos_test_total{domain='${domain}'})`,
      legendFormat: '{{result}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        color: {
          mode: 'palette-classic',
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'passed' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }],
        },
        {
          matcher: { id: 'byName', options: 'failed' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
        },
        {
          matcher: { id: 'byName', options: 'skipped' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'yellow' } }],
        },
      ],
    },
    options: {
      legend: {
        displayMode: 'table',
        placement: 'right',
        showLegend: true,
        calcs: ['sum'],
      },
      pieType: 'donut',
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
      tooltip: {
        mode: 'single',
      },
    },
  };
}

/**
 * Chaos test history timeseries
 */
export function createChaosHistoryPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Chaos Test History',
    type: 'timeseries',
    targets: [{
      expr: `sum by (result) (rate(isl_chaos_test_total{domain='${domain}'}[1h]))`,
      legendFormat: '{{result}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'short',
        custom: {
          lineWidth: 2,
          fillOpacity: 30,
          gradientMode: 'opacity',
          showPoints: 'never',
          stacking: {
            mode: 'normal',
            group: 'A',
          },
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'passed' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }],
        },
        {
          matcher: { id: 'byName', options: 'failed' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
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
 * Failure categories breakdown
 */
export function createFailureCategoriesPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Failure Categories',
    type: 'piechart',
    targets: [{
      expr: `sum by (category) (isl_verification_failures_total{domain='${domain}'})`,
      legendFormat: '{{category}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        color: {
          mode: 'palette-classic',
        },
      },
    },
    options: {
      legend: {
        displayMode: 'table',
        placement: 'right',
        showLegend: true,
        calcs: ['sum', 'percent'],
      },
      pieType: 'pie',
      reduceOptions: {
        calcs: ['sum'],
        fields: '',
        values: false,
      },
    },
  };
}

/**
 * Recent failures table
 */
export function createRecentFailuresPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Recent Failures',
    type: 'table',
    targets: [{
      expr: `isl_verification_failures_total{domain='${domain}'} > 0`,
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
          matcher: { id: 'byName', options: 'category' },
          properties: [
            {
              id: 'custom.displayMode',
              value: 'color-text',
            },
            {
              id: 'mappings',
              value: [
                { type: 'value', options: { postconditions: { color: 'red' } } },
                { type: 'value', options: { invariants: { color: 'orange' } } },
                { type: 'value', options: { scenarios: { color: 'yellow' } } },
              ],
            },
          ],
        },
      ],
    },
    description: 'Failures detected in recent verification runs',
  };
}

/**
 * Self-healing events panel
 */
export function createSelfHealingPanel(options: AlertPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Self-Healing Events',
    type: 'timeseries',
    targets: [
      {
        expr: `sum(rate(isl_selfhealing_events_total{domain='${domain}',action='repaired'}[1h]))`,
        legendFormat: 'Repaired',
        refId: 'A',
      },
      {
        expr: `sum(rate(isl_selfhealing_events_total{domain='${domain}',action='quarantined'}[1h]))`,
        legendFormat: 'Quarantined',
        refId: 'B',
      },
      {
        expr: `sum(rate(isl_selfhealing_events_total{domain='${domain}',action='fallback'}[1h]))`,
        legendFormat: 'Fallback',
        refId: 'C',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'short',
        custom: {
          lineWidth: 2,
          fillOpacity: 20,
          showPoints: 'never',
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'Repaired' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'green' } }],
        },
        {
          matcher: { id: 'byName', options: 'Quarantined' },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'orange' } }],
        },
        {
          matcher: { id: 'byName', options: 'Fallback' },
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
      },
    },
  };
}
