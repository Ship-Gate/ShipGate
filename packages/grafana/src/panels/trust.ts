/**
 * Trust Score Panels
 * 
 * Panels for displaying trust score breakdowns and trends.
 */

import type { Panel } from '../types.js';

export interface TrustPanelOptions {
  domain: string;
}

/**
 * Trust score breakdown by category
 */
export function createTrustBreakdownPanel(options: TrustPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Trust Score Breakdown',
    type: 'bargauge',
    targets: [{
      expr: `isl_trust_score_breakdown{domain='${domain}'}`,
      legendFormat: '{{category}}',
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
            { value: 90, color: 'green' },
          ],
        },
      },
      overrides: [
        {
          matcher: { id: 'byName', options: 'postconditions' },
          properties: [{ id: 'displayName', value: 'Postconditions (40%)' }],
        },
        {
          matcher: { id: 'byName', options: 'invariants' },
          properties: [{ id: 'displayName', value: 'Invariants (30%)' }],
        },
        {
          matcher: { id: 'byName', options: 'scenarios' },
          properties: [{ id: 'displayName', value: 'Scenarios (20%)' }],
        },
        {
          matcher: { id: 'byName', options: 'temporal' },
          properties: [{ id: 'displayName', value: 'Temporal (10%)' }],
        },
      ],
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
 * Trust score by behavior
 */
export function createTrustByBehaviorPanel(options: TrustPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Trust Score by Behavior',
    type: 'bargauge',
    targets: [{
      expr: `isl_trust_score{domain='${domain}'} by (behavior)`,
      legendFormat: '{{behavior}}',
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
            { value: 85, color: 'light-green' },
            { value: 95, color: 'green' },
          ],
        },
      },
    },
    options: {
      orientation: 'horizontal',
      displayMode: 'lcd',
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
    },
  };
}

/**
 * Trust score trend over time
 */
export function createTrustTrendPanel(options: TrustPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Trust Score Trend',
    type: 'timeseries',
    targets: [{
      expr: `isl_trust_score{domain='${domain}'}`,
      legendFormat: 'Overall',
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        unit: 'percent',
        min: 0,
        max: 100,
        custom: {
          lineWidth: 3,
          fillOpacity: 30,
          gradientMode: 'opacity',
          showPoints: 'never',
          spanNulls: true,
        },
        color: {
          mode: 'thresholds',
        },
        thresholds: {
          mode: 'absolute',
          steps: [
            { value: null, color: 'red' },
            { value: 70, color: 'yellow' },
            { value: 85, color: 'green' },
          ],
        },
      },
    },
    options: {
      legend: {
        displayMode: 'list',
        placement: 'bottom',
        showLegend: false,
      },
      tooltip: {
        mode: 'single',
      },
    },
  };
}

/**
 * Confidence score gauge
 */
export function createConfidencePanel(options: TrustPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Confidence',
    type: 'gauge',
    targets: [{
      expr: `isl_confidence_score{domain='${domain}'}`,
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
            { value: null, color: 'yellow' },
            { value: 50, color: 'light-green' },
            { value: 80, color: 'green' },
          ],
        },
      },
    },
    options: {
      showThresholdLabels: false,
      showThresholdMarkers: true,
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
    },
    description: 'Based on test coverage and verification completeness',
  };
}

/**
 * Recommendation status panel
 */
export function createRecommendationPanel(options: TrustPanelOptions): Panel {
  const { domain } = options;
  
  return {
    title: 'Deployment Recommendation',
    type: 'stat',
    targets: [{
      expr: `isl_recommendation{domain='${domain}'}`,
      refId: 'A',
    }],
    fieldConfig: {
      defaults: {
        mappings: [
          { type: 'value', options: { '1': { text: '🚀 Production Ready', color: 'green' } } },
          { type: 'value', options: { '2': { text: '🧪 Staging Recommended', color: 'light-green' } } },
          { type: 'value', options: { '3': { text: '👁️ Shadow Mode', color: 'yellow' } } },
          { type: 'value', options: { '4': { text: '⚠️ Not Ready', color: 'orange' } } },
          { type: 'value', options: { '5': { text: '🚨 Critical Issues', color: 'red' } } },
        ],
      },
    },
    options: {
      reduceOptions: {
        calcs: ['lastNotNull'],
        fields: '',
        values: false,
      },
      colorMode: 'background',
    },
  };
}
