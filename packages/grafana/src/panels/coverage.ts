/**
 * Coverage Panels
 * 
 * Panels for displaying coverage metrics.
 */

import type { Panel } from '../types.js';

export interface CoveragePanelOptions {
  domain: string;
}

/**
 * Coverage by category bar gauge
 */
export function createCoverageByCategory(options: CoveragePanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Coverage by Category',
    type: 'bargauge',
    targets: [{
      expr: `isl_coverage_ratio{domain='${domain}'}`,
      legendFormat: '{{category}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percentunit',
        min: 0,
        max: 1,
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'red' },
            { value: 0.5, color: 'yellow' },
            { value: 0.8, color: 'green' },
          ],
        },
      },
    },
    options: {
      orientation: 'horizontal',
      displayMode: 'gradient',
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
    },
  };
}

/**
 * Overall coverage stat
 */
export function createOverallCoveragePanel(options: CoveragePanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Overall Coverage',
    type: 'stat',
    targets: [{
      expr: `avg(isl_coverage_ratio{domain='${domain}'})`,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percentunit',
        min: 0,
        max: 1,
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'red' },
            { value: 0.6, color: 'yellow' },
            { value: 0.8, color: 'green' },
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
 * Coverage by behavior table
 */
export function createCoverageTablePanel(options: CoveragePanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Coverage by Behavior',
    type: 'table',
    targets: [
      {
        expr: `isl_coverage_ratio{domain='${domain}',category='postconditions'}`,
        legendFormat: 'Postconditions',
        refId: 'A',
        instant: true,
      },
      {
        expr: `isl_coverage_ratio{domain='${domain}',category='invariants'}`,
        legendFormat: 'Invariants',
        refId: 'B',
        instant: true,
      },
      {
        expr: `isl_coverage_ratio{domain='${domain}',category='scenarios'}`,
        legendFormat: 'Scenarios',
        refId: 'C',
        instant: true,
      },
    ],
    fieldConfig: {
      defaults: {
        unit: 'percentunit',
        custom: {
          align: 'center',
          displayMode: 'color-background-solid',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'red' },
            { value: 0.5, color: 'yellow' },
            { value: 0.8, color: 'green' },
          ],
        },
      },
    },
  };
}

/**
 * Coverage trend timeseries
 */
export function createCoverageTrendPanel(options: CoveragePanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Coverage Trend',
    type: 'timeseries',
    targets: [{
      expr: `avg(isl_coverage_ratio{domain='${domain}'}) by (category)`,
      legendFormat: '{{category}}',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percentunit',
        min: 0,
        max: 1,
        custom: {
          lineWidth: 2,
          fillOpacity: 20,
          gradientMode: 'opacity',
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
 * Uncovered behaviors list
 */
export function createUncoveredBehaviorsPanel(options: CoveragePanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Uncovered Behaviors',
    type: 'table',
    targets: [{
      expr: `isl_coverage_ratio{domain='${domain}'} < 0.8`,
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
    },
    description: 'Behaviors with less than 80% coverage',
  };
}
