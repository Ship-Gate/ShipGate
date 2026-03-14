import type { FieldConstraints, FieldTypeKind } from './types.js';

const REALISTIC_NAMES = ['Alice Johnson', 'Bob Smith', 'Carlos Rivera', 'Diana Chen', 'Ethan Park'];
const REALISTIC_EMAILS = ['alice@example.com', 'bob.smith@company.org', 'carlos.r@mail.co'];
const REALISTIC_URLS = ['https://example.com', 'https://api.service.io/v2', 'https://cdn.assets.net/img'];
const REALISTIC_PHONES = ['+1-555-867-5309', '+44-20-7946-0958', '+81-3-1234-5678'];
const REALISTIC_WORDS = ['quantum', 'nexus', 'horizon', 'cascade', 'vortex', 'zenith', 'prism', 'catalyst'];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUUID(): string {
  const hex = '0123456789abcdef';
  const seg = (n: number) => Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${hex[8 + Math.floor(Math.random() * 4)]}${seg(3)}-${seg(12)}`;
}

export function generateValidValue(type: FieldTypeKind | string, constraints?: FieldConstraints): unknown {
  switch (type) {
    case 'String': {
      const minLen = constraints?.minLength ?? 3;
      const maxLen = constraints?.maxLength ?? 64;
      const targetLen = randomInt(minLen, Math.min(maxLen, minLen + 20));
      if (targetLen <= 10) return randomString(targetLen);
      return `${randomElement(REALISTIC_WORDS)}_${randomString(targetLen - 8)}`;
    }

    case 'Int': {
      const min = constraints?.min ?? 1;
      const max = constraints?.max ?? 10000;
      return randomInt(min, max);
    }

    case 'Decimal': {
      const min = constraints?.min ?? 0.01;
      const max = constraints?.max ?? 99999.99;
      return Math.round((Math.random() * (max - min) + min) * 100) / 100;
    }

    case 'Boolean':
      return true;

    case 'Email':
      return randomElement(REALISTIC_EMAILS);

    case 'URL':
      return randomElement(REALISTIC_URLS);

    case 'UUID':
      return randomUUID();

    case 'Phone':
      return randomElement(REALISTIC_PHONES);

    case 'Date':
    case 'Timestamp':
      return new Date(Date.now() - randomInt(0, 365 * 24 * 60 * 60 * 1000)).toISOString();

    case 'Duration':
      return `${randomInt(1, 300)}s`;

    case 'enum': {
      const values = constraints?.enumValues ?? ['ACTIVE', 'INACTIVE'];
      return randomElement(values);
    }

    default:
      if (type.startsWith('enum:')) {
        const values = type.slice(5).split(',').map(v => v.trim());
        return randomElement(values);
      }
      return randomElement(REALISTIC_NAMES);
  }
}

export function generateInvalidValue(type: FieldTypeKind | string, constraints?: FieldConstraints): unknown {
  switch (type) {
    case 'String': {
      if (constraints?.minLength && constraints.minLength > 1) {
        return randomString(constraints.minLength - 1);
      }
      if (constraints?.maxLength) {
        return randomString(constraints.maxLength + 10);
      }
      return '';
    }

    case 'Int': {
      if (constraints?.min !== undefined) return constraints.min - 1;
      if (constraints?.max !== undefined) return constraints.max + 1;
      return 'not-a-number';
    }

    case 'Decimal': {
      if (constraints?.min !== undefined) return constraints.min - 0.01;
      if (constraints?.max !== undefined) return constraints.max + 0.01;
      return 'not-a-decimal';
    }

    case 'Boolean':
      return 'not-a-boolean';

    case 'Email':
      return 'not-an-email-address';

    case 'URL':
      return 'not a valid url !!!';

    case 'UUID':
      return 'not-a-valid-uuid';

    case 'Phone':
      return 'abc123';

    case 'Date':
    case 'Timestamp':
      return 'not-a-date';

    case 'Duration':
      return 'invalid-duration';

    case 'enum': {
      return '__INVALID_ENUM_VALUE__';
    }

    default:
      return null;
  }
}

export function generateBoundaryValues(
  type: FieldTypeKind | string,
  constraints?: FieldConstraints,
): Array<{ label: string; value: unknown; shouldFail: boolean }> {
  const results: Array<{ label: string; value: unknown; shouldFail: boolean }> = [];

  switch (type) {
    case 'String': {
      results.push({ label: 'empty string', value: '', shouldFail: true });
      if (constraints?.minLength && constraints.minLength > 0) {
        results.push({
          label: `${constraints.minLength - 1}-char string (below min)`,
          value: randomString(Math.max(0, constraints.minLength - 1)),
          shouldFail: true,
        });
        results.push({
          label: `${constraints.minLength}-char string (at min)`,
          value: randomString(constraints.minLength),
          shouldFail: false,
        });
      }
      if (constraints?.maxLength) {
        results.push({
          label: `${constraints.maxLength}-char string (at max)`,
          value: randomString(constraints.maxLength),
          shouldFail: false,
        });
        results.push({
          label: `${constraints.maxLength + 1}-char string (above max)`,
          value: randomString(constraints.maxLength + 1),
          shouldFail: true,
        });
      }
      break;
    }

    case 'Int': {
      if (constraints?.min !== undefined) {
        results.push({ label: `int at min (${constraints.min})`, value: constraints.min, shouldFail: false });
        results.push({ label: `int below min (${constraints.min - 1})`, value: constraints.min - 1, shouldFail: true });
      }
      if (constraints?.max !== undefined) {
        results.push({ label: `int at max (${constraints.max})`, value: constraints.max, shouldFail: false });
        results.push({ label: `int above max (${constraints.max + 1})`, value: constraints.max + 1, shouldFail: true });
      }
      results.push({ label: 'non-numeric string', value: 'abc', shouldFail: true });
      break;
    }

    case 'Decimal': {
      if (constraints?.min !== undefined) {
        results.push({ label: `decimal at min (${constraints.min})`, value: constraints.min, shouldFail: false });
        results.push({ label: `decimal below min`, value: constraints.min - 0.01, shouldFail: true });
      }
      if (constraints?.max !== undefined) {
        results.push({ label: `decimal at max (${constraints.max})`, value: constraints.max, shouldFail: false });
        results.push({ label: `decimal above max`, value: constraints.max + 0.01, shouldFail: true });
      }
      break;
    }

    case 'Email':
      results.push({ label: 'valid email', value: 'user@example.com', shouldFail: false });
      results.push({ label: 'email missing @', value: 'userexample.com', shouldFail: true });
      results.push({ label: 'email missing domain', value: 'user@', shouldFail: true });
      results.push({ label: 'email with spaces', value: 'user @example.com', shouldFail: true });
      break;

    case 'URL':
      results.push({ label: 'valid https URL', value: 'https://example.com/path', shouldFail: false });
      results.push({ label: 'missing protocol', value: 'example.com', shouldFail: true });
      results.push({ label: 'invalid URL with spaces', value: 'https://not a url.com', shouldFail: true });
      break;

    case 'UUID':
      results.push({ label: 'valid UUID v4', value: randomUUID(), shouldFail: false });
      results.push({ label: 'truncated UUID', value: 'a1b2c3d4-e5f6', shouldFail: true });
      results.push({ label: 'non-hex UUID', value: 'zzzzzzzz-zzzz-4zzz-zzzz-zzzzzzzzzzzz', shouldFail: true });
      break;

    case 'Phone':
      results.push({ label: 'valid phone', value: '+1-555-123-4567', shouldFail: false });
      results.push({ label: 'letters in phone', value: 'abc-def-ghij', shouldFail: true });
      results.push({ label: 'too short phone', value: '123', shouldFail: true });
      break;

    case 'Boolean':
      results.push({ label: 'true', value: true, shouldFail: false });
      results.push({ label: 'false', value: false, shouldFail: false });
      results.push({ label: 'string "true"', value: 'true', shouldFail: true });
      break;
  }

  return results;
}
