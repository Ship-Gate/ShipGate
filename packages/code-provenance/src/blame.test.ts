import { describe, it, expect } from 'vitest';
import { parseBlameOutput } from './blame.js';

const HASH_A = 'a'.repeat(40);
const HASH_B = 'b'.repeat(40);
const HASH_C = 'c'.repeat(40);

describe('parseBlameOutput', () => {
  it('parses a single blame entry with full metadata', () => {
    const raw = [
      `${HASH_A} 1 1 1`,
      'author John Doe',
      'author-mail <john@example.com>',
      'author-time 1709337600',
      'author-tz +0000',
      'committer Jane Smith',
      'committer-mail <jane@example.com>',
      'committer-time 1709337700',
      'committer-tz -0500',
      'summary Initial commit',
      'filename src/index.ts',
      '\tconst x = 1;',
    ].join('\n');

    const entries = parseBlameOutput(raw);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      commitHash: HASH_A,
      lineNumber: 1,
      content: 'const x = 1;',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorTimestamp: 1709337600,
      authorTz: '+0000',
      committerName: 'Jane Smith',
      committerEmail: 'jane@example.com',
      committerTimestamp: 1709337700,
      committerTz: '-0500',
      summary: 'Initial commit',
    });
  });

  it('handles repeated commit hashes (cached metadata)', () => {
    const raw = [
      `${HASH_A} 1 1 3`,
      'author John Doe',
      'author-mail <john@example.com>',
      'author-time 1709337600',
      'author-tz +0000',
      'committer John Doe',
      'committer-mail <john@example.com>',
      'committer-time 1709337600',
      'committer-tz +0000',
      'summary Add functions',
      'filename src/index.ts',
      '\tline one',
      `${HASH_A} 2 2`,
      '\tline two',
      `${HASH_A} 3 3`,
      '\tline three',
    ].join('\n');

    const entries = parseBlameOutput(raw);

    expect(entries).toHaveLength(3);
    expect(entries[0]!.lineNumber).toBe(1);
    expect(entries[0]!.content).toBe('line one');
    expect(entries[1]!.lineNumber).toBe(2);
    expect(entries[1]!.content).toBe('line two');
    expect(entries[1]!.authorName).toBe('John Doe');
    expect(entries[2]!.lineNumber).toBe(3);
    expect(entries[2]!.content).toBe('line three');
    expect(entries[2]!.summary).toBe('Add functions');
  });

  it('handles multiple different commits', () => {
    const raw = [
      `${HASH_B} 1 1 1`,
      'author Alice',
      'author-mail <alice@co.com>',
      'author-time 1700000000',
      'author-tz +0000',
      'committer Alice',
      'committer-mail <alice@co.com>',
      'committer-time 1700000000',
      'committer-tz +0000',
      'summary First commit',
      'filename f.ts',
      '\timport x;',
      `${HASH_C} 2 2 1`,
      'author Bob',
      'author-mail <bob@co.com>',
      'author-time 1700100000',
      'author-tz +0000',
      'committer Bob',
      'committer-mail <bob@co.com>',
      'committer-time 1700100000',
      'committer-tz +0000',
      'summary Second commit',
      'filename f.ts',
      '\texport y;',
    ].join('\n');

    const entries = parseBlameOutput(raw);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.authorName).toBe('Alice');
    expect(entries[0]!.summary).toBe('First commit');
    expect(entries[1]!.authorName).toBe('Bob');
    expect(entries[1]!.summary).toBe('Second commit');
  });

  it('returns empty array for empty input', () => {
    expect(parseBlameOutput('')).toEqual([]);
  });

  it('strips angle brackets from email addresses', () => {
    const raw = [
      `${HASH_A} 1 1 1`,
      'author Test',
      'author-mail <test@example.com>',
      'author-time 1700000000',
      'author-tz +0000',
      'committer Test',
      'committer-mail <test@example.com>',
      'committer-time 1700000000',
      'committer-tz +0000',
      'summary test',
      'filename test.ts',
      '\tcode',
    ].join('\n');

    const entries = parseBlameOutput(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.authorEmail).toBe('test@example.com');
    expect(entries[0]!.committerEmail).toBe('test@example.com');
  });
});
