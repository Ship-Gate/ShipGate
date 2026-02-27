// ============================================================================
// Validation Function Emitter
// Generates client-side validate() functions from ValidationRule[]
// ============================================================================

import type { FieldUIModel, ValidationRule } from '../types.js';

export function emitValidationFn(
  fnName: string,
  fields: FieldUIModel[],
  extraRules: ValidationRule[] = [],
): string {
  const lines: string[] = [];

  lines.push(`export function ${fnName}(values: Record<string, unknown>): Record<string, string> {`);
  lines.push('  const errors: Record<string, string> = {};');

  for (const field of fields) {
    for (const rule of field.validation) {
      lines.push(emitRuleCheck(field.name, rule));
    }
  }

  for (const rule of extraRules) {
    const fieldName = rule.field ?? 'unknown';
    lines.push(emitRuleCheck(fieldName, rule));
  }

  lines.push('  return errors;');
  lines.push('}');

  return lines.join('\n');
}

function emitRuleCheck(fieldName: string, rule: ValidationRule): string {
  const a = `values['${fieldName}']`;
  const s = `String(${a} ?? '')`;

  switch (rule.type) {
    case 'required':
      return `  if (${a} == null || ${a} === '') {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'minLength':
      return `  if (${s}.length < ${rule.value}) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'maxLength':
      return `  if (${s}.length > ${rule.value}) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'min':
      return `  if (Number(${a}) < ${rule.value}) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'max':
      return `  if (Number(${a}) > ${rule.value}) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'pattern':
      return `  if (${a} != null && !new RegExp(${JSON.stringify(rule.value)}).test(String(${a}))) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'email':
      return `  if (${a} != null && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(${a}))) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'matches':
      return `  if (${a} !== values['${rule.value}']) {\n    errors['${fieldName}'] = ${JSON.stringify(rule.message)};\n  }`;
    case 'custom':
      return `  // Custom: ${rule.value} — ${rule.message}`;
    default:
      return '';
  }
}
