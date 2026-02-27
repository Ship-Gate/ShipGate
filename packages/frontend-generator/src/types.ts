// ============================================================================
// Frontend Generator Types
// ============================================================================

import type {
  Domain,
  Entity,
  Behavior,
  ApiBlock,
  EndpointDecl,
  ScreenDecl,
  ComponentDecl,
  Field,
  Identifier,
  StringLiteral,
} from '@isl-lang/parser';

export interface FrontendGeneratorOptions {
  /** Domain AST from parser */
  domain: Domain;
  /** Base API URL for fetch/React Query */
  baseUrl?: string;
  /** Output directory prefix (e.g. 'src') */
  outputPrefix?: string;
  /** App name for layout */
  appName?: string;
}

export interface GeneratedFrontendFile {
  path: string;
  content: string;
  type: 'page' | 'component' | 'layout' | 'lib' | 'api' | 'config';
}

export interface FrontendGenerationResult {
  success: boolean;
  files: GeneratedFrontendFile[];
  shadcnComponents: string[];
  errors: string[];
}

// --- Field/Form mapping ---

export type FieldInputType =
  | 'text'
  | 'email'
  | 'number'
  | 'select'
  | 'boolean'
  | 'date'
  | 'textarea'
  | 'file';

export interface MappedField {
  name: string;
  label: string;
  type: FieldInputType;
  tsType: string;
  optional: boolean;
  enumValues?: string[];
}

// --- Component mapping config ---

export interface ComponentMappingConfig {
  /** ISL field type → shadcn component */
  fieldToComponent: Record<FieldInputType, string>;
  /** ISL screen → layout component */
  screenLayout: string;
  /** ISL form → Form component */
  formComponent: string;
  /** ISL entity list → DataTable */
  entityListComponent: string;
}

export const DEFAULT_COMPONENT_MAPPING: ComponentMappingConfig = {
  fieldToComponent: {
    text: 'Input',
    email: 'Input',
    number: 'Input',
    select: 'Select',
    boolean: 'Switch',
    date: 'DatePicker',
    textarea: 'Textarea',
    file: 'FileInput',
  },
  screenLayout: 'Shell',
  formComponent: 'Form',
  entityListComponent: 'DataTable',
};

// Re-export parser types for convenience
export type {
  Domain,
  Entity,
  Behavior,
  ApiBlock,
  EndpointDecl,
  ScreenDecl,
  ComponentDecl,
  Field,
  Identifier,
  StringLiteral,
};
