// ============================================================================
// Advanced Documentation Types
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// OUTPUT FORMATS
// ============================================================================

export type OutputFormat = 'nextra' | 'docusaurus' | 'markdown' | 'html';

export type DiagramFormat = 'mermaid' | 'plantuml' | 'svg';

// ============================================================================
// GENERATOR OPTIONS
// ============================================================================

export interface GeneratorOptions {
  /** Output format */
  format: OutputFormat;
  
  /** Output directory */
  outputDir: string;
  
  /** Theme to use */
  theme?: ThemeName;
  
  /** Custom theme configuration */
  themeConfig?: Partial<ThemeConfig>;
  
  /** Include interactive examples */
  interactive?: boolean;
  
  /** Include code sandboxes */
  sandboxes?: boolean;
  
  /** Generate diagrams */
  diagrams?: boolean;
  
  /** Diagram format */
  diagramFormat?: DiagramFormat;
  
  /** Base URL for links */
  baseUrl?: string;
  
  /** Version for docs */
  version?: string;
  
  /** Include version comparison */
  versionComparison?: boolean;
  
  /** Previous version for comparison */
  previousVersion?: string;
}

// ============================================================================
// DOCUMENTATION STRUCTURE
// ============================================================================

export interface Documentation {
  /** Metadata */
  meta: DocumentationMeta;
  
  /** Navigation structure */
  navigation: NavigationItem[];
  
  /** Pages */
  pages: DocumentationPage[];
  
  /** Assets (diagrams, images) */
  assets: Asset[];
}

export interface DocumentationMeta {
  title: string;
  description: string;
  version: string;
  generatedAt: string;
  domain: string;
}

export interface NavigationItem {
  title: string;
  path: string;
  children?: NavigationItem[];
  icon?: string;
}

export interface DocumentationPage {
  /** Page path */
  path: string;
  
  /** Page title */
  title: string;
  
  /** Page description */
  description?: string;
  
  /** Frontmatter for MDX */
  frontmatter: Record<string, unknown>;
  
  /** Page content (MDX/Markdown) */
  content: string;
  
  /** Page sections */
  sections: PageSection[];
}

export interface PageSection {
  id: string;
  title: string;
  level: number;
  content: string;
}

export interface Asset {
  path: string;
  type: 'diagram' | 'image' | 'code';
  content: string;
}

// ============================================================================
// API REFERENCE
// ============================================================================

export interface APIReference {
  /** Domain info */
  domain: DomainInfo;
  
  /** Types documentation */
  types: TypeDoc[];
  
  /** Entities documentation */
  entities: EntityDoc[];
  
  /** Behaviors documentation */
  behaviors: BehaviorDoc[];
  
  /** Views documentation */
  views: ViewDoc[];
  
  /** Invariants documentation */
  invariants: InvariantDoc[];
}

export interface DomainInfo {
  name: string;
  version: string;
  description?: string;
  owner?: string;
}

export interface TypeDoc {
  name: string;
  description?: string;
  definition: string;
  constraints: ConstraintDoc[];
  examples: string[];
}

export interface ConstraintDoc {
  name: string;
  value: string;
  description?: string;
}

export interface EntityDoc {
  name: string;
  description?: string;
  fields: FieldDoc[];
  invariants: string[];
  lifecycle?: LifecycleDoc;
  examples: ExampleDoc[];
}

export interface FieldDoc {
  name: string;
  type: string;
  description?: string;
  annotations: string[];
  optional: boolean;
  defaultValue?: string;
}

export interface LifecycleDoc {
  states: string[];
  transitions: TransitionDoc[];
  diagram: string;
}

export interface TransitionDoc {
  from: string;
  to: string;
}

export interface BehaviorDoc {
  name: string;
  description?: string;
  actors?: ActorDoc[];
  input: InputOutputDoc;
  output: InputOutputDoc;
  errors: ErrorDoc[];
  preconditions: ConditionDoc[];
  postconditions: PostconditionGroupDoc[];
  invariants: string[];
  temporal: TemporalDoc[];
  security: SecurityDoc[];
  examples: ExampleDoc[];
  sequenceDiagram?: string;
  tryIt?: TryItConfig;
}

export interface ActorDoc {
  name: string;
  constraints: string[];
}

export interface InputOutputDoc {
  fields: FieldDoc[];
  schema: string;
}

export interface ErrorDoc {
  name: string;
  when?: string;
  retriable: boolean;
  retryAfter?: string;
  returns?: string;
}

export interface ConditionDoc {
  expression: string;
  description?: string;
}

export interface PostconditionGroupDoc {
  condition: string;
  predicates: ConditionDoc[];
}

export interface TemporalDoc {
  type: string;
  predicate: string;
  duration?: string;
  percentile?: string;
}

export interface SecurityDoc {
  type: string;
  details: string;
}

export interface ViewDoc {
  name: string;
  forEntity: string;
  fields: ViewFieldDoc[];
  consistency: string;
  cache?: string;
}

export interface ViewFieldDoc {
  name: string;
  type: string;
  computation: string;
}

export interface InvariantDoc {
  name: string;
  description?: string;
  scope: string;
  predicates: string[];
}

// ============================================================================
// EXAMPLES & TUTORIALS
// ============================================================================

export interface ExampleDoc {
  name: string;
  description: string;
  given?: string[];
  when: string[];
  then: string[];
  code?: string;
  interactive?: boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  prerequisites: string[];
  steps: TutorialStep[];
  outcomes: string[];
}

export interface TutorialStep {
  title: string;
  content: string;
  code?: CodeBlock;
  exercise?: Exercise;
  checkpoint?: Checkpoint;
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface Exercise {
  prompt: string;
  hints: string[];
  solution: CodeBlock;
  validation?: string;
}

export interface Checkpoint {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// ============================================================================
// INTERACTIVE FEATURES
// ============================================================================

export interface TryItConfig {
  endpoint?: string;
  defaultInput: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  mockResponse?: boolean;
}

export interface SandboxConfig {
  template: 'typescript' | 'javascript' | 'node';
  files: SandboxFile[];
  dependencies: Record<string, string>;
  entryFile: string;
}

export interface SandboxFile {
  path: string;
  content: string;
  hidden?: boolean;
}

// ============================================================================
// THEMES
// ============================================================================

export type ThemeName = 'default' | 'corporate' | 'minimal' | 'dark';

export interface ThemeConfig {
  name: ThemeName;
  colors: ThemeColors;
  fonts: ThemeFonts;
  code: CodeTheme;
  layout: LayoutConfig;
  components: ComponentStyles;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface ThemeFonts {
  sans: string;
  mono: string;
  heading: string;
}

export interface CodeTheme {
  theme: string;
  lineNumbers: boolean;
  copyButton: boolean;
}

export interface LayoutConfig {
  maxWidth: string;
  sidebarWidth: string;
  tocWidth: string;
}

export interface ComponentStyles {
  callout: Record<string, string>;
  card: Record<string, string>;
  badge: Record<string, string>;
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

export interface VersionComparison {
  currentVersion: string;
  previousVersion: string;
  changes: VersionChange[];
  summary: ChangeSummary;
}

export interface VersionChange {
  type: 'added' | 'removed' | 'modified' | 'deprecated';
  category: 'type' | 'entity' | 'behavior' | 'invariant' | 'view';
  name: string;
  description: string;
  details?: string;
  breaking: boolean;
}

export interface ChangeSummary {
  added: number;
  removed: number;
  modified: number;
  deprecated: number;
  breaking: number;
}

// ============================================================================
// GENERATED OUTPUT
// ============================================================================

export interface GeneratedDocs {
  files: GeneratedFile[];
  navigation: NavigationItem[];
  searchIndex?: SearchIndexEntry[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'page' | 'config' | 'asset' | 'component';
}

export interface SearchIndexEntry {
  title: string;
  path: string;
  content: string;
  section?: string;
  keywords: string[];
}
