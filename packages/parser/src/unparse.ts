// ============================================================================
// ISL Unparse - Serialize AST back to ISL source text
// Used for round-trip parse stability tests.
// ============================================================================

import type {
  Domain,
  Entity,
  Field,
  TypeDeclaration,
  TypeDefinition,
  Behavior,
  Expression,
  Import,
  InvariantBlock,
  Policy,
  View,
  ScenarioBlock,
  Scenario,
  ChaosBlock,
  ChaosScenario,
  Statement,
  UseStatement,
} from './ast.js';

const INDENT = '  ';

/**
 * Serialize a Domain AST to ISL source text.
 * Produces output that should parse back to an equivalent AST.
 */
export function unparse(domain: Domain): string {
  const lines: string[] = [];

  lines.push(`domain ${id(domain.name)} {`);
  lines.push(`${INDENT}version: ${str(domain.version)}`);
  if (domain.owner) {
    lines.push(`${INDENT}owner: ${str(domain.owner)}`);
  }

  for (const u of domain.uses ?? []) {
    lines.push('');
    lines.push(unparseUse(u));
  }

  for (const imp of domain.imports ?? []) {
    lines.push('');
    lines.push(unparseImport(imp));
  }

  for (const t of domain.types ?? []) {
    lines.push('');
    lines.push(unparseType(t));
  }

  for (const e of domain.entities ?? []) {
    lines.push('');
    lines.push(unparseEntity(e));
  }

  for (const b of domain.behaviors ?? []) {
    lines.push('');
    lines.push(unparseBehavior(b));
  }

  for (const inv of domain.invariants ?? []) {
    lines.push('');
    lines.push(unparseInvariantBlock(inv));
  }

  for (const p of domain.policies ?? []) {
    lines.push('');
    lines.push(unparsePolicy(p));
  }

  for (const v of domain.views ?? []) {
    lines.push('');
    lines.push(unparseView(v));
  }

  for (const s of domain.scenarios ?? []) {
    lines.push('');
    lines.push(unparseScenarioBlock(s));
  }

  for (const c of domain.chaos ?? []) {
    lines.push('');
    lines.push(unparseChaosBlock(c));
  }

  lines.push('}');
  return lines.join('\n');
}

function unparseUse(u: UseStatement): string {
  const mod = u.module.kind === 'StringLiteral' ? str(u.module) : id(u.module);
  let out = `use ${mod}`;
  if (u.version) out += ` @ ${str(u.version)}`;
  if (u.alias) out += ` as ${id(u.alias)}`;
  return out + ';';
}

function unparseImport(imp: Import): string {
  const items = (imp.items ?? []).map((i) =>
    i.alias ? `${id(i.name)} as ${id(i.alias)}` : id(i.name)
  );
  return `imports { ${items.join(', ')} } from ${str(imp.from)}`;
}

function unparseType(t: TypeDeclaration): string {
  if (t.definition.kind === 'EnumType') {
    const variants = (t.definition.variants ?? []).map((v) => {
      if (v.value) return `${id(v.name)} = ${expr(v.value)}`;
      return id(v.name);
    });
    return `enum ${id(t.name)} {\n${INDENT}${variants.join('\n' + INDENT)}\n}`;
  }
  const def = typeDef(t.definition);
  const annots = (t.annotations ?? []).map((a) =>
    a.value ? `${id(a.name)}: ${expr(a.value)}` : id(a.name)
  );
  const annotStr = annots.length ? ` [${annots.join(', ')}]` : '';
  return `type ${id(t.name)} = ${def}${annotStr}`;
}

function unparseEntity(e: Entity): string {
  const lines: string[] = [`entity ${id(e.name)} {`];
  for (const f of e.fields ?? []) {
    lines.push(unparseField(f));
  }
  if ((e.invariants ?? []).length > 0) {
    lines.push(`${INDENT}invariants {`);
    for (const inv of e.invariants) {
      lines.push(`${INDENT}${INDENT}- ${expr(inv)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if (e.lifecycle && (e.lifecycle.transitions ?? []).length > 0) {
    lines.push(`${INDENT}lifecycle {`);
    for (const t of e.lifecycle.transitions) {
      lines.push(`${INDENT}${INDENT}${id(t.from)} -> ${id(t.to)}`);
    }
    lines.push(`${INDENT}}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function unparseField(f: Field): string {
  // Output optional on the type (name: Type?) - avoid double ? when type is already OptionalType
  const baseType = f.type.kind === 'OptionalType' ? (f.type as { inner: TypeDefinition }).inner : f.type;
  const typeStr = f.optional ? `${typeDef(baseType)}?` : typeDef(f.type);
  const annots = (f.annotations ?? []).map((a) =>
    a.value ? `${id(a.name)}: ${expr(a.value)}` : id(a.name)
  );
  const annotStr = annots.length ? ` [${annots.join(', ')}]` : '';
  const def = f.defaultValue ? ` = ${expr(f.defaultValue)}` : '';
  return `${INDENT}${id(f.name)}: ${typeStr}${annotStr}${def}`;
}

function unparseBehavior(b: Behavior): string {
  const lines: string[] = [`behavior ${id(b.name)} {`];
  if (b.description) {
    lines.push(`${INDENT}description: ${str(b.description)}`);
  }
  if (b.actors && b.actors.length > 0) {
    lines.push(`${INDENT}actors {`);
    for (const a of b.actors) {
      const constraints = (a.constraints ?? []).map((c) => expr(c)).join(', ');
      lines.push(`${INDENT}${INDENT}${id(a.name)} { ${constraints} }`);
    }
    lines.push(`${INDENT}}`);
  }
  if (b.input && (b.input.fields ?? []).length > 0) {
    lines.push(`${INDENT}input {`);
    for (const f of b.input.fields) {
      lines.push(unparseField(f).replace(/^  /, INDENT + INDENT));
    }
    lines.push(`${INDENT}}`);
  }
  if (b.output) {
    lines.push(`${INDENT}output {`);
    lines.push(`${INDENT}${INDENT}success: ${typeDef(b.output.success)}`);
    if (b.output.errors && b.output.errors.length > 0) {
      lines.push(`${INDENT}${INDENT}errors {`);
      for (const err of b.output.errors) {
        const whenStr = err.when ? ` when: ${str(err.when)}` : '';
        const retry = err.retriable ? ` retriable: ${err.retriable}` : '';
        const retryAfter = err.retryAfter ? ` retry_after: ${expr(err.retryAfter)}` : '';
        lines.push(`${INDENT}${INDENT}${INDENT}${id(err.name)} {${whenStr}${retry}${retryAfter}}`);
      }
      lines.push(`${INDENT}${INDENT}}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.preconditions ?? []).length > 0) {
    lines.push(`${INDENT}preconditions {`);
    for (const p of b.preconditions) {
      lines.push(`${INDENT}${INDENT}- ${expr(p)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.postconditions ?? []).length > 0) {
    lines.push(`${INDENT}postconditions {`);
    for (const block of b.postconditions) {
      const cond =
        typeof block.condition === 'string'
          ? block.condition
          : (block.condition as { name: string }).name;
      lines.push(`${INDENT}${INDENT}${cond} implies {`);
      for (const pred of block.predicates ?? []) {
        lines.push(`${INDENT}${INDENT}${INDENT}- ${expr(pred)}`);
      }
      lines.push(`${INDENT}${INDENT}}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.invariants ?? []).length > 0) {
    lines.push(`${INDENT}invariants {`);
    for (const inv of b.invariants) {
      lines.push(`${INDENT}${INDENT}- ${expr(inv)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.temporal ?? []).length > 0) {
    lines.push(`${INDENT}temporal {`);
    for (const t of b.temporal) {
      let spec = t.operator;
      if (t.duration) spec += ` within ${duration(t.duration)}`;
      if (t.percentile) spec += ` (p${t.percentile})`;
      spec += `: ${expr(t.predicate)}`;
      lines.push(`${INDENT}${INDENT}${spec}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.security ?? []).length > 0) {
    lines.push(`${INDENT}security {`);
    for (const s of b.security) {
      lines.push(`${INDENT}${INDENT}${s.type} ${expr(s.details)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((b.compliance ?? []).length > 0) {
    lines.push(`${INDENT}compliance {`);
    for (const c of b.compliance) {
      const reqs = (c.requirements ?? []).map((r) => expr(r)).join(', ');
      lines.push(`${INDENT}${INDENT}${id(c.standard)} { ${reqs} }`);
    }
    lines.push(`${INDENT}}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function unparseInvariantBlock(inv: InvariantBlock): string {
  const lines: string[] = [`invariants ${id(inv.name)} {`];
  if (inv.description) lines.push(`${INDENT}description: ${str(inv.description)}`);
  if (inv.scope && inv.scope !== 'global') lines.push(`${INDENT}scope: ${inv.scope}`);
  for (const p of inv.predicates ?? []) {
    lines.push(`${INDENT}- ${expr(p)}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function unparsePolicy(p: Policy): string {
  const lines: string[] = [`policy ${id(p.name)} {`];
  const target =
    p.appliesTo.target === 'all'
      ? 'all'
      : (p.appliesTo.target as { name: string }[]).map((t) => id(t)).join(', ');
  lines.push(`${INDENT}applies_to: ${target}`);
  lines.push(`${INDENT}rules {`);
  for (const r of p.rules ?? []) {
    const cond = r.condition ? `${expr(r.condition)}: ` : 'default: ';
    lines.push(`${INDENT}${INDENT}${cond}${expr(r.action)}`);
  }
  lines.push(`${INDENT}}`);
  lines.push('}');
  return lines.join('\n');
}

function unparseView(v: View): string {
  const entityName = qualName(v.forEntity?.name);
  const lines: string[] = [`view ${id(v.name)} {`];
  if (entityName) {
    lines.push(`${INDENT}for: ${entityName}`);
  }
  if ((v.fields ?? []).length > 0) {
    lines.push(`${INDENT}fields {`);
    for (const f of v.fields) {
      lines.push(`${INDENT}${INDENT}${id(f.name)}: ${typeDef(f.type)} = ${expr(f.computation)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if (v.consistency) {
    lines.push(`${INDENT}consistency { ${v.consistency.mode} }`);
  }
  if (v.cache) {
    const inv = (v.cache.invalidateOn ?? []).length > 0 ? expr(v.cache.invalidateOn[0]) : '';
    lines.push(`${INDENT}cache { ttl: ${duration(v.cache.ttl)}${inv ? ` invalidate_on: ${inv}` : ''} }`);
  }
  lines.push('}');
  return lines.join('\n');
}

function unparseScenarioBlock(s: ScenarioBlock): string {
  const lines: string[] = [`scenarios ${id(s.behaviorName)} {`];
  for (const sc of s.scenarios ?? []) {
    lines.push(unparseScenario(sc));
  }
  lines.push('}');
  return lines.join('\n');
}

function unparseScenario(sc: Scenario): string {
  const lines: string[] = [`scenario ${str(sc.name)} {`];
  if ((sc.given ?? []).length > 0) {
    lines.push(`${INDENT}given {`);
    for (const stmt of sc.given) {
      lines.push(`${INDENT}${INDENT}${stmtToStr(stmt)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((sc.when ?? []).length > 0) {
    lines.push(`${INDENT}when {`);
    for (const stmt of sc.when) {
      lines.push(`${INDENT}${INDENT}${stmtToStr(stmt)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((sc.then ?? []).length > 0) {
    lines.push(`${INDENT}then {`);
    for (const ex of sc.then) {
      lines.push(`${INDENT}${INDENT}${expr(ex)}`);
    }
    lines.push(`${INDENT}}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function stmtToStr(stmt: Statement): string {
  if (stmt.kind === 'AssignmentStmt' && stmt.target && stmt.value) {
    return `${id(stmt.target)} = ${expr(stmt.value)}`;
  }
  if (stmt.kind === 'CallStmt' && stmt.call) {
    return expr(stmt.call);
  }
  return '';
}

function unparseChaosBlock(c: ChaosBlock): string {
  const lines: string[] = [`chaos ${id(c.behaviorName)} {`];
  for (const sc of c.scenarios ?? []) {
    lines.push(unparseChaosScenario(sc));
  }
  lines.push('}');
  return lines.join('\n');
}

function unparseChaosScenario(sc: ChaosScenario): string {
  const lines: string[] = [`scenario ${str(sc.name)} {`];
  if ((sc.inject ?? []).length > 0) {
    lines.push(`${INDENT}inject {`);
    for (const inj of sc.inject) {
      // Injection.target is the full expression (e.g. CallExpr: database_failure(target: X, mode: Y))
      const targetExpr = inj.target;
      const injStr = targetExpr ? expr(targetExpr) : 'database_failure()';
      lines.push(`${INDENT}${INDENT}${injStr}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((sc.when ?? []).length > 0) {
    lines.push(`${INDENT}when {`);
    for (const stmt of sc.when) {
      lines.push(`${INDENT}${INDENT}${stmtToStr(stmt)}`);
    }
    lines.push(`${INDENT}}`);
  }
  if ((sc.then ?? []).length > 0) {
    lines.push(`${INDENT}then {`);
    for (const ex of sc.then) {
      lines.push(`${INDENT}${INDENT}${expr(ex)}`);
    }
    lines.push(`${INDENT}}`);
  }
  const expectations = sc.expectations ?? [];
  if (expectations.length > 0) {
    lines.push(`${INDENT}expect {`);
    for (const ex of expectations) {
      lines.push(`${INDENT}${INDENT}${expr(ex.condition)}`);
    }
    lines.push(`${INDENT}}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function typeDef(t: TypeDefinition): string {
  if (!t || typeof t !== 'object') return 'unknown';
  const x = t as unknown as Record<string, unknown>;
  switch (x.kind) {
    case 'PrimitiveType':
      return (x.name as string) ?? 'String';
    case 'ReferenceType': {
      const n = x.name as { parts?: { name: string }[] };
      return n?.parts?.map((p) => p.name).join('.') ?? 'unknown';
    }
    case 'ListType':
      return `List<${typeDef(x.element as TypeDefinition)}>`;
    case 'MapType':
      return `Map<${typeDef(x.key as TypeDefinition)}, ${typeDef(x.value as TypeDefinition)}>`;
    case 'OptionalType':
      return `${typeDef(x.inner as TypeDefinition)}?`;
    case 'ConstrainedType': {
      const base = typeDef(x.base as TypeDefinition);
      const constraints = (x.constraints as { name: string; value: Expression }[] ?? []).map(
        (c) => `${c.name}: ${expr(c.value)}`
      );
      return `${base} { ${constraints.join(' ')} }`;
    }
    case 'StructType': {
      const fields = (x.fields as Field[] ?? []).map(
        (f) => `${id(f.name)}${f.optional ? '?' : ''}: ${typeDef(f.type)}`
      );
      return `{ ${fields.join(' ')} }`;
    }
    case 'EnumType': {
      const variants = (x.variants as { name: { name: string } }[] ?? []).map((v) => v.name.name);
      return variants.join(' | ');
    }
    case 'UnionType': {
      const variants = (x.variants as { name: { name: string } }[] ?? []).map((v) => v.name.name);
      return variants.join(' | ');
    }
    default:
      return 'unknown';
  }
}

function expr(e: Expression | undefined): string {
  if (!e || typeof e !== 'object') return '';
  const x = e as unknown as Record<string, unknown>;
  switch (x.kind) {
    case 'Identifier':
      return (x.name as string) ?? '';
    case 'QualifiedName': {
      const parts = (x.parts as { name: string }[]) ?? [];
      return parts.map((p) => p.name).join('.');
    }
    case 'StringLiteral':
      return str(x as { kind: string; value: string });
    case 'NumberLiteral':
      return String(x.value);
    case 'BooleanLiteral':
      return x.value ? 'true' : 'false';
    case 'NullLiteral':
      return 'null';
    case 'DurationLiteral':
      return duration(x as { value: number; unit: string });
    case 'BinaryExpr':
      return `(${expr(x.left as Expression)} ${x.operator} ${expr(x.right as Expression)})`;
    case 'UnaryExpr':
      return `(${x.operator} ${expr(x.operand as Expression)})`;
    case 'MemberExpr':
      return `${expr(x.object as Expression)}.${(x.property as { name: string })?.name}`;
    case 'CallExpr': {
      const args = ((x.arguments as Expression[]) ?? []).map(expr).join(', ');
      return `${expr(x.callee as Expression)}(${args})`;
    }
    case 'IndexExpr':
      return `${expr(x.object as Expression)}[${expr(x.index as Expression)}]`;
    case 'OldExpr':
      return `old(${expr(x.expression as Expression)})`;
    case 'ResultExpr':
      return x.property ? `result.${(x.property as { name: string }).name}` : 'result';
    case 'InputExpr':
      return `input.${(x.property as { name: string })?.name}`;
    case 'QuantifierExpr': {
      const v = x.variable as { name: string };
      return `${x.quantifier} ${v?.name} in ${expr(x.collection as Expression)}: ${expr(x.predicate as Expression)}`;
    }
    case 'ConditionalExpr':
      return `(${expr(x.condition as Expression)} ? ${expr(x.thenBranch as Expression)} : ${expr(x.elseBranch as Expression)})`;
    case 'LambdaExpr': {
      const params = ((x.params as { name: string }[]) ?? []).map((p) => p.name).join(', ');
      return `(${params}) => ${expr(x.body as Expression)}`;
    }
    case 'ListExpr': {
      const elts = ((x.elements as Expression[]) ?? []).map(expr).join(', ');
      return `[${elts}]`;
    }
    case 'MapExpr': {
      const entries = ((x.entries as { key: Expression; value: Expression }[]) ?? []).map(
        (en) => `${expr(en.key)}: ${expr(en.value)}`
      );
      return `{ ${entries.join(', ')} }`;
    }
    default:
      return `[${x.kind}]`;
  }
}

function id(node: { name: string } | { kind: string; name: string }): string {
  if (!node) return '';
  return (node as { name: string }).name ?? '';
}

function qualName(node: { parts?: { name: string }[] } | undefined): string {
  if (!node?.parts) return '';
  return node.parts.map((p) => p.name).join('.');
}

function str(node: { kind: string; value: string }): string {
  if (!node) return '""';
  const v = (node as { value: string }).value ?? '';
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function duration(node: { value: number; unit: string }): string {
  if (!node) return '0s';
  return `${node.value}.${node.unit}`;
}
