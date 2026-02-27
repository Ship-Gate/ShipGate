// ============================================================================
// TypeScript Types Emitter
// ============================================================================

import type { Entity, Behavior, TypeDeclaration, TypeDefinition } from '@isl-lang/parser';

function resolveTsType(type: TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      const prim: Record<string, string> = {
        String: 'string',
        Int: 'number',
        Decimal: 'number',
        Boolean: 'boolean',
        Timestamp: 'string',
        UUID: 'string',
        Duration: 'string',
      };
      return prim[type.name] ?? 'unknown';
    case 'ReferenceType': {
      const qn = type.name as { parts?: Array<{ name: string }> };
      return qn.parts?.length ? qn.parts[qn.parts.length - 1]!.name : 'unknown';
    }
    case 'OptionalType':
      return resolveTsType(type.inner) + ' | null';
    case 'ListType':
      return resolveTsType(type.element) + '[]';
    default:
      return 'unknown';
  }
}

export function emitTypes(
  entities: Entity[],
  behaviors: Behavior[],
  types: TypeDeclaration[]
): string {
  const lines: string[] = ['// Auto-generated types from ISL', ''];

  const enums = types.filter(
    (t) => t.definition && (t.definition as { kind?: string }).kind === 'EnumType'
  );
  for (const e of enums) {
    const def = e.definition as { variants?: Array<{ name: { name: string } }> };
    const variants = def?.variants ?? [];
    lines.push(`export enum ${e.name.name} {`);
    for (const v of variants) {
      lines.push(`  ${v.name.name} = "${v.name.name}",`);
    }
    lines.push('}', '');
  }

  for (const entity of entities) {
    lines.push(`export interface ${entity.name.name} {`);
    for (const f of entity.fields) {
      const opt = f.optional ? '?' : '';
      const ts = resolveTsType(f.type);
      lines.push(`  ${f.name.name}${opt}: ${ts};`);
    }
    lines.push('}', '');
  }

  for (const b of behaviors) {
    if (b.input?.fields?.length) {
      lines.push(`export interface ${b.name.name}Input {`);
      for (const f of b.input.fields) {
        const opt = f.optional ? '?' : '';
        const ts = resolveTsType(f.type);
        lines.push(`  ${f.name.name}${opt}: ${ts};`);
      }
      lines.push('}', '');
    }
  }

  return lines.join('\n');
}
