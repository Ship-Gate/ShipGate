/**
 * Dashboard Rows Builder
 * 
 * Creates organized rows of panels for the Grafana dashboard.
 */

import type { Row, Panel, GridPos } from './types.js';
import {
  createTrustScorePanel,
  createVerificationRatePanel,
  createFailureRatePanel,
  createVerificationsTimeseriesPanel,
  createScoreTrendPanel,
} from './panels/verification.js';
import {
  createCoverageByCategory,
  createOverallCoveragePanel,
  createCoverageTrendPanel,
} from './panels/coverage.js';
import {
  createLatencyHeatmapPanel,
  createP99LatencyPanel,
  createLatencyPercentilesPanel,
  createSLACompliancePanel,
} from './panels/latency.js';
import {
  createTrustBreakdownPanel,
  createTrustByBehaviorPanel,
  createConfidencePanel,
  createRecommendationPanel,
} from './panels/trust.js';
import {
  createChaosResultsPanel,
  createChaosHistoryPanel,
  createFailureCategoriesPanel,
  createSelfHealingPanel,
} from './panels/alerts.js';

export interface RowBuilderOptions {
  domain: string;
  includeAlerts?: boolean;
  includeChaos?: boolean;
}

let panelIdCounter = 1;

/**
 * Assign grid positions and IDs to panels
 */
function assignPositions(panels: Panel[], startY: number): Panel[] {
  let x = 0;
  let y = startY;
  const maxWidth = 24;
  
  return panels.map((panel, index) => {
    // Determine panel width based on type
    let width: number;
    switch (panel.type) {
      case 'gauge':
      case 'stat':
        width = 6;
        break;
      case 'piechart':
        width = 8;
        break;
      case 'bargauge':
        width = 12;
        break;
      case 'heatmap':
      case 'timeseries':
      case 'table':
      default:
        width = 12;
        break;
    }
    
    // Wrap to next row if needed
    if (x + width > maxWidth) {
      x = 0;
      y += 8;
    }
    
    const gridPos: GridPos = {
      x,
      y,
      w: width,
      h: 8,
    };
    
    x += width;
    
    return {
      ...panel,
      id: panelIdCounter++,
      gridPos,
    };
  });
}

/**
 * Create Overview row
 */
export function createOverviewRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createTrustScorePanel(panelOptions),
    createRecommendationPanel(panelOptions),
    createVerificationRatePanel(panelOptions),
    createFailureRatePanel(panelOptions),
  ], 0);
  
  return {
    title: 'Overview',
    panels,
  };
}

/**
 * Create Trust Score row
 */
export function createTrustRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createTrustBreakdownPanel(panelOptions),
    createConfidencePanel(panelOptions),
    createTrustByBehaviorPanel(panelOptions),
  ], 0);
  
  return {
    title: 'Trust Score',
    panels,
  };
}

/**
 * Create Verification Trends row
 */
export function createVerificationTrendsRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createVerificationsTimeseriesPanel(panelOptions),
    createScoreTrendPanel(panelOptions),
  ], 0);
  
  return {
    title: 'Verification Trends',
    panels,
  };
}

/**
 * Create Coverage row
 */
export function createCoverageRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createOverallCoveragePanel(panelOptions),
    createCoverageByCategory(panelOptions),
    createCoverageTrendPanel(panelOptions),
  ], 0);
  
  return {
    title: 'Coverage',
    panels,
  };
}

/**
 * Create Latency row
 */
export function createLatencyRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createLatencyPercentilesPanel(panelOptions),
    createSLACompliancePanel(panelOptions),
    createLatencyHeatmapPanel(panelOptions),
    createP99LatencyPanel(panelOptions),
  ], 0);
  
  return {
    title: 'Latency',
    panels,
  };
}

/**
 * Create Chaos Testing row
 */
export function createChaosRow(options: RowBuilderOptions): Row {
  const { domain } = options;
  const panelOptions = { domain };
  
  const panels = assignPositions([
    createChaosResultsPanel(panelOptions),
    createChaosHistoryPanel(panelOptions),
    createFailureCategoriesPanel(panelOptions),
    createSelfHealingPanel(panelOptions),
  ], 0);
  
  return {
    title: 'Chaos Testing',
    collapse: true,
    panels,
  };
}

/**
 * Build all rows for a domain dashboard
 */
export function buildRows(options: RowBuilderOptions): Row[] {
  panelIdCounter = 1; // Reset counter
  
  const rows: Row[] = [
    createOverviewRow(options),
    createTrustRow(options),
    createVerificationTrendsRow(options),
    createCoverageRow(options),
    createLatencyRow(options),
  ];
  
  if (options.includeChaos !== false) {
    rows.push(createChaosRow(options));
  }
  
  return rows;
}
