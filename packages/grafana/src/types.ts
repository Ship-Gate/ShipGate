/**
 * Grafana Dashboard Types
 */

export interface GrafanaDashboard {
  dashboard: Dashboard;
  overwrite?: boolean;
  folderId?: number;
  folderUid?: string;
  message?: string;
}

export interface Dashboard {
  id?: number | null;
  uid?: string;
  title: string;
  tags: string[];
  timezone?: string;
  schemaVersion?: number;
  version?: number;
  refresh?: string;
  time?: TimeRange;
  rows?: Row[];
  panels?: Panel[];
  templating?: Templating;
  annotations?: Annotations;
  links?: DashboardLink[];
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface Row {
  title: string;
  collapse?: boolean;
  height?: string | number;
  panels: Panel[];
}

export interface Panel {
  id?: number;
  title: string;
  type: PanelType;
  gridPos?: GridPos;
  targets: Target[];
  options?: PanelOptions;
  fieldConfig?: FieldConfig;
  thresholds?: Threshold[];
  description?: string;
  transparent?: boolean;
  datasource?: DataSource;
}

export type PanelType = 
  | 'gauge'
  | 'stat'
  | 'timeseries'
  | 'bargauge'
  | 'heatmap'
  | 'piechart'
  | 'table'
  | 'text'
  | 'graph'
  | 'alertlist'
  | 'row';

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Target {
  expr: string;
  legendFormat?: string;
  refId?: string;
  interval?: string;
  instant?: boolean;
}

export interface PanelOptions {
  legend?: LegendOptions;
  tooltip?: TooltipOptions;
  orientation?: 'horizontal' | 'vertical' | 'auto';
  displayMode?: 'basic' | 'lcd' | 'gradient';
  showThresholdLabels?: boolean;
  showThresholdMarkers?: boolean;
  reduceOptions?: ReduceOptions;
  text?: TextOptions;
  pieType?: 'pie' | 'donut';
  colorMode?: 'value' | 'background' | 'background_solid' | 'none';
  // Alert list options
  alertName?: string;
  dashboardAlerts?: boolean;
  groupMode?: string;
  maxItems?: number;
  sortOrder?: number;
  stateFilter?: Record<string, boolean>;
  // Heatmap options
  calculate?: boolean;
  cellGap?: number;
  color?: Record<string, unknown>;
  exemplars?: Record<string, unknown>;
  filterValues?: Record<string, unknown>;
  rowsFrame?: Record<string, unknown>;
  showValue?: string;
  yAxis?: Record<string, unknown>;
}

export interface LegendOptions {
  displayMode?: 'list' | 'table' | 'hidden';
  placement?: 'bottom' | 'right';
  showLegend?: boolean;
  calcs?: string[];
  show?: boolean;
}

export interface TooltipOptions {
  mode?: 'single' | 'multi' | 'none';
  sort?: 'none' | 'asc' | 'desc';
  show?: boolean;
  yHistogram?: boolean;
}

export interface ReduceOptions {
  values?: boolean;
  calcs?: string[];
  fields?: string;
}

export interface TextOptions {
  mode?: 'auto' | 'markdown' | 'html';
}

export interface FieldConfig {
  defaults?: FieldConfigDefaults;
  overrides?: FieldOverride[];
}

export interface FieldConfigDefaults {
  unit?: string;
  decimals?: number;
  min?: number;
  max?: number;
  color?: ColorConfig;
  thresholds?: ThresholdConfig;
  mappings?: ValueMapping[];
  custom?: Record<string, unknown>;
}

export interface ColorConfig {
  mode: 'thresholds' | 'palette-classic' | 'continuous-GrYlRd' | 'fixed';
  fixedColor?: string;
}

export interface ThresholdConfig {
  mode: 'absolute' | 'percentage';
  steps: ThresholdStep[];
}

export interface ThresholdStep {
  value: number | null;
  color: string;
}

export interface Threshold {
  value: number;
  color: string;
  op?: 'gt' | 'lt';
}

export interface ValueMapping {
  type: 'value' | 'range' | 'regex' | 'special';
  options: Record<string, unknown>;
}

export interface FieldOverride {
  matcher: {
    id: string;
    options?: unknown;
  };
  properties: Array<{
    id: string;
    value: unknown;
  }>;
}

export interface DataSource {
  type?: string;
  uid?: string;
}

export interface Templating {
  list: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: 'query' | 'custom' | 'constant' | 'datasource' | 'interval';
  query?: string;
  label?: string;
  hide?: 0 | 1 | 2;
  multi?: boolean;
  includeAll?: boolean;
  current?: {
    text: string;
    value: string;
  };
  options?: Array<{
    text: string;
    value: string;
    selected?: boolean;
  }>;
  refresh?: 0 | 1 | 2;
  regex?: string;
  sort?: number;
}

export interface Annotations {
  list: Annotation[];
}

export interface Annotation {
  name: string;
  datasource: DataSource;
  enable?: boolean;
  hide?: boolean;
  iconColor?: string;
  type?: string;
  builtIn?: number;
}

export interface DashboardLink {
  title: string;
  type: 'link' | 'dashboards';
  url?: string;
  tags?: string[];
  asDropdown?: boolean;
  targetBlank?: boolean;
  icon?: string;
}

export interface GeneratorOptions {
  datasource?: string;
  refresh?: string;
  timeRange?: TimeRange;
  includeAlerts?: boolean;
  includeChaos?: boolean;
}
