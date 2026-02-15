// ============================================================================
// ISL → shadcn/ui Component Mapping Configuration
// ============================================================================

import type { ComponentMappingConfig, FieldInputType, MappedField } from './types.js';
import type { Field, TypeDefinition } from '@isl-lang/parser';

/** shadcn/ui components required for generated frontend */
export const SHADCN_COMPONENTS = [
  'button',
  'input',
  'label',
  'form',
  'select',
  'switch',
  'textarea',
  'table',
  'card',
  'dropdown-menu',
  'avatar',
  'separator',
  'skeleton',
  'sonner', // toast
] as const;

/** CLI command to install all required shadcn components */
export const SHADCN_INSTALL_CMD = `npx shadcn@latest add ${SHADCN_COMPONENTS.join(' ')}`;

/** Map ISL field type to HTML input type / shadcn component */
export function mapFieldType(
  field: Field,
  enumNames: Set<string>
): { inputType: FieldInputType; htmlType?: string } {
  const typeName = resolveTypeName(field.type);
  const fieldName = field.name.name.toLowerCase();

  if (fieldName.includes('email')) return { inputType: 'email', htmlType: 'email' };
  if (fieldName.includes('password') || fieldName.includes('secret'))
    return { inputType: 'text', htmlType: 'password' };

  if (enumNames.has(typeName)) return { inputType: 'select' };

  switch (typeName) {
    case 'Boolean':
    case 'Bool':
      return { inputType: 'boolean' };
    case 'Int':
    case 'Integer':
    case 'Float':
    case 'Double':
    case 'Decimal':
    case 'Money':
      return { inputType: 'number', htmlType: 'number' };
    case 'Date':
      return { inputType: 'date' };
    case 'DateTime':
    case 'Timestamp':
      return { inputType: 'date', htmlType: 'datetime-local' };
    case 'Binary':
    case 'Blob':
      return { inputType: 'file' };
    default:
      return { inputType: 'text' };
  }
}

/** Resolve type name from TypeDefinition */
function resolveTypeName(type: TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return type.name;
    case 'ReferenceType': {
      const qn = type.name as { parts?: Array<{ name: string }> };
      return qn.parts?.length ? qn.parts[qn.parts.length - 1]!.name : 'unknown';
    }
    case 'ListType':
      return resolveTypeName(type.element) + '[]';
    case 'OptionalType':
      return resolveTypeName(type.inner);
    case 'EnumType':
      return 'enum';
    case 'ConstrainedType':
      return resolveTypeName(type.base);
    default:
      return 'unknown';
  }
}

/** Map Field to MappedField for form generation */
export function mapFieldToMapped(
  field: Field,
  enumNames: Set<string>,
  enumValues?: Record<string, string[]>
): MappedField {
  const { inputType } = mapFieldType(field, enumNames);
  const typeName = resolveTypeName(field.type);

  const tsTypeMap: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Integer: 'number',
    Float: 'number',
    Double: 'number',
    Decimal: 'number',
    Money: 'number',
    Boolean: 'boolean',
    Bool: 'boolean',
    UUID: 'string',
    Timestamp: 'string',
    Date: 'string',
    DateTime: 'string',
    Binary: 'File | FileList',
    Blob: 'File | FileList',
  };

  return {
    name: field.name.name,
    label: toDisplayName(field.name.name),
    type: inputType,
    tsType: tsTypeMap[typeName] ?? typeName,
    optional: field.optional,
    enumValues: enumValues?.[typeName],
  };
}

function toDisplayName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Default component mapping for reference */
export const DEFAULT_MAPPING: ComponentMappingConfig = {
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
