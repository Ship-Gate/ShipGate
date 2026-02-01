/**
 * Grafana Dashboard Generator
 * 
 * Generates Grafana dashboards from ISL domain specifications.
 */

import type { GrafanaDashboard, Dashboard, Panel, Templating, GeneratorOptions, Row } from './types.js';
import { buildRows } from './rows.js';

/**
 * Simplified Domain interface for dashboard generation
 * Compatible with @intentos/parser Domain type
 */
export interface Domain {
  name: { value: string };
  behaviors: Array<{ name: { value: string } }>;
}

/**
 * Generate Grafana dashboard from ISL domain
 */
export function generate(domain: Domain, options: GeneratorOptions = {}): GrafanaDashboard {
  const domainName = domain.name.value;
  const behaviors = domain.behaviors.map(b => b.name.value);
  
  const dashboard = createDashboard(domainName, behaviors, options);
  
  return {
    dashboard,
    overwrite: true,
    message: `Auto-generated from ISL domain: ${domainName}`,
  };
}

/**
 * Create dashboard structure
 */
function createDashboard(
  domainName: string,
  behaviors: string[],
  options: GeneratorOptions
): Dashboard {
  const rows = buildRows({
    domain: domainName.toLowerCase(),
    includeAlerts: options.includeAlerts,
    includeChaos: options.includeChaos,
  });
  
  // Flatten rows into panels with proper positioning
  const panels = flattenRows(rows);
  
  return {
    uid: `isl-${domainName.toLowerCase()}`,
    title: `ISL - ${domainName} Domain`,
    tags: ['isl', 'verification', domainName.toLowerCase()],
    timezone: 'browser',
    schemaVersion: 38,
    version: 1,
    refresh: options.refresh ?? '30s',
    time: options.timeRange ?? {
      from: 'now-1h',
      to: 'now',
    },
    panels,
    templating: createTemplating(domainName, behaviors),
    annotations: {
      list: [
        {
          name: 'Deployments',
          datasource: {
            type: 'prometheus',
            uid: '${datasource}',
          },
          enable: true,
          iconColor: 'blue',
          type: 'dashboard',
        },
        {
          name: 'Incidents',
          datasource: {
            type: 'prometheus',
            uid: '${datasource}',
          },
          enable: true,
          iconColor: 'red',
          type: 'dashboard',
        },
      ],
    },
    links: [
      {
        title: 'ISL Documentation',
        type: 'link',
        url: 'https://intentos.dev/docs',
        targetBlank: true,
        icon: 'doc',
      },
      {
        title: 'Related Dashboards',
        type: 'dashboards',
        tags: ['isl'],
        asDropdown: true,
      },
    ],
  };
}

/**
 * Flatten rows into a single panels array with row headers
 */
function flattenRows(rows: Row[]): Panel[] {
  const panels: Panel[] = [];
  let currentY = 0;
  let panelId = 100;
  
  for (const row of rows) {
    // Add row panel (collapsed section header)
    const rowPanel: Panel = {
      id: panelId++,
      type: 'row' as const,
      title: row.title,
      targets: [],
      gridPos: {
        x: 0,
        y: currentY,
        w: 24,
        h: 1,
      },
    };
    panels.push(rowPanel);
    
    currentY += 1;
    
    // Add panels if not collapsed
    if (!row.collapse) {
      for (const panel of row.panels) {
        const flatPanel: Panel = {
          ...panel,
          id: panelId++,
          gridPos: panel.gridPos ? {
            ...panel.gridPos,
            y: panel.gridPos.y + currentY,
          } : undefined,
        };
        panels.push(flatPanel);
      }
      
      // Calculate max Y from panels
      const maxPanelY = Math.max(
        ...row.panels.map(p => (p.gridPos?.y ?? 0) + (p.gridPos?.h ?? 8))
      );
      currentY += maxPanelY;
    }
  }
  
  return panels;
}

/**
 * Create dashboard templating variables
 */
function createTemplating(domainName: string, behaviors: string[]): Templating {
  return {
    list: [
      {
        name: 'datasource',
        type: 'datasource',
        query: 'prometheus',
        label: 'Data Source',
        hide: 0,
        current: {
          text: 'Prometheus',
          value: 'prometheus',
        },
      },
      {
        name: 'domain',
        type: 'query',
        query: 'label_values(isl_verification_total, domain)',
        label: 'Domain',
        hide: 0,
        multi: false,
        includeAll: false,
        current: {
          text: domainName.toLowerCase(),
          value: domainName.toLowerCase(),
        },
        refresh: 1,
        sort: 1,
      },
      {
        name: 'behavior',
        type: 'query',
        query: "label_values(isl_verification_total{domain='$domain'}, behavior)",
        label: 'Behavior',
        hide: 0,
        multi: true,
        includeAll: true,
        refresh: 1,
        sort: 1,
      },
      {
        name: 'verdict',
        type: 'custom',
        query: 'verified,unsafe,unknown',
        label: 'Verdict',
        hide: 0,
        multi: true,
        includeAll: true,
        options: [
          { text: 'All', value: '$__all', selected: true },
          { text: 'Verified', value: 'verified', selected: false },
          { text: 'Unsafe', value: 'unsafe', selected: false },
          { text: 'Unknown', value: 'unknown', selected: false },
        ],
      },
      {
        name: 'interval',
        type: 'interval',
        query: '1m,5m,15m,30m,1h,6h,12h,1d',
        label: 'Interval',
        hide: 0,
        current: {
          text: '5m',
          value: '5m',
        },
      },
    ],
  };
}

/**
 * Generate dashboard JSON string
 */
export function generateJSON(domain: Domain, options: GeneratorOptions = {}): string {
  const dashboard = generate(domain, options);
  return JSON.stringify(dashboard, null, 2);
}

/**
 * Generate dashboard for multiple domains
 */
export function generateMultipleDashboards(
  domains: Domain[],
  options: GeneratorOptions = {}
): GrafanaDashboard[] {
  return domains.map(domain => generate(domain, options));
}
