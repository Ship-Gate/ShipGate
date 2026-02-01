'use client';

import clsx from 'clsx';

interface StateDiff {
  path: string[];
  oldValue: unknown;
  newValue: unknown;
}

interface DiffViewerProps {
  diffs: StateDiff[];
}

export function DiffViewer({ diffs }: DiffViewerProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic text-center py-4">
        No changes detected
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">
        {diffs.length} change{diffs.length !== 1 ? 's' : ''} detected
      </div>

      <div className="space-y-2">
        {diffs.map((diff, index) => (
          <DiffEntry key={index} diff={diff} />
        ))}
      </div>
    </div>
  );
}

interface DiffEntryProps {
  diff: StateDiff;
}

function DiffEntry({ diff }: DiffEntryProps) {
  const pathString = diff.path.length > 0 ? diff.path.join('.') : '(root)';
  const changeType = getChangeType(diff.oldValue, diff.newValue);

  return (
    <div className="border rounded overflow-hidden">
      {/* Header */}
      <div className={clsx(
        'px-3 py-2 flex items-center justify-between text-sm',
        changeType === 'added' && 'bg-green-50 border-b border-green-100',
        changeType === 'removed' && 'bg-red-50 border-b border-red-100',
        changeType === 'modified' && 'bg-yellow-50 border-b border-yellow-100'
      )}>
        <span className="font-mono font-medium">{pathString}</span>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded',
          changeType === 'added' && 'bg-green-200 text-green-800',
          changeType === 'removed' && 'bg-red-200 text-red-800',
          changeType === 'modified' && 'bg-yellow-200 text-yellow-800'
        )}>
          {changeType}
        </span>
      </div>

      {/* Values */}
      <div className="p-3 bg-white">
        {changeType !== 'added' && (
          <div className="flex items-start gap-2 mb-2">
            <span className="text-red-500 font-mono text-sm">-</span>
            <ValueDisplay value={diff.oldValue} variant="removed" />
          </div>
        )}
        {changeType !== 'removed' && (
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-mono text-sm">+</span>
            <ValueDisplay value={diff.newValue} variant="added" />
          </div>
        )}
      </div>
    </div>
  );
}

interface ValueDisplayProps {
  value: unknown;
  variant: 'added' | 'removed';
}

function ValueDisplay({ value, variant }: ValueDisplayProps) {
  const formatted = formatValue(value);
  const isMultiline = formatted.includes('\n');

  return (
    <div className={clsx(
      'flex-1 font-mono text-sm rounded px-2 py-1 overflow-auto max-h-32',
      variant === 'added' && 'bg-green-50 text-green-800',
      variant === 'removed' && 'bg-red-50 text-red-800'
    )}>
      {isMultiline ? (
        <pre className="whitespace-pre-wrap">{formatted}</pre>
      ) : (
        <span>{formatted}</span>
      )}
    </div>
  );
}

function getChangeType(oldValue: unknown, newValue: unknown): 'added' | 'removed' | 'modified' {
  if (oldValue === undefined || oldValue === null) return 'added';
  if (newValue === undefined || newValue === null) return 'removed';
  return 'modified';
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

// Side-by-side diff viewer for more complex comparisons
interface SideBySideDiffProps {
  oldValue: unknown;
  newValue: unknown;
  title?: string;
}

export function SideBySideDiff({ oldValue, newValue, title }: SideBySideDiffProps) {
  const oldFormatted = formatValue(oldValue);
  const newFormatted = formatValue(newValue);

  return (
    <div className="border rounded overflow-hidden">
      {title && (
        <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium">
          {title}
        </div>
      )}
      
      <div className="grid grid-cols-2 divide-x">
        {/* Old value */}
        <div className="p-3">
          <div className="text-xs text-red-500 mb-2 font-medium">Before</div>
          <pre className="text-sm font-mono bg-red-50 p-2 rounded overflow-auto max-h-48 text-red-800">
            {oldFormatted}
          </pre>
        </div>

        {/* New value */}
        <div className="p-3">
          <div className="text-xs text-green-500 mb-2 font-medium">After</div>
          <pre className="text-sm font-mono bg-green-50 p-2 rounded overflow-auto max-h-48 text-green-800">
            {newFormatted}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Inline diff for simple text changes
interface InlineDiffProps {
  oldText: string;
  newText: string;
}

export function InlineDiff({ oldText, newText }: InlineDiffProps) {
  // Simple character-level diff
  const oldChars = oldText.split('');
  const newChars = newText.split('');

  // Find common prefix and suffix
  let prefixLen = 0;
  while (prefixLen < oldChars.length && 
         prefixLen < newChars.length && 
         oldChars[prefixLen] === newChars[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (suffixLen < oldChars.length - prefixLen && 
         suffixLen < newChars.length - prefixLen &&
         oldChars[oldChars.length - 1 - suffixLen] === newChars[newChars.length - 1 - suffixLen]) {
    suffixLen++;
  }

  const prefix = oldText.slice(0, prefixLen);
  const oldMiddle = oldText.slice(prefixLen, oldText.length - suffixLen);
  const newMiddle = newText.slice(prefixLen, newText.length - suffixLen);
  const suffix = oldText.slice(oldText.length - suffixLen);

  return (
    <span className="font-mono text-sm">
      {prefix}
      {oldMiddle && (
        <span className="bg-red-200 text-red-800 line-through">{oldMiddle}</span>
      )}
      {newMiddle && (
        <span className="bg-green-200 text-green-800">{newMiddle}</span>
      )}
      {suffix}
    </span>
  );
}
