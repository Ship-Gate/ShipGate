'use client';

// ============================================================================
// Side-by-Side Diff View
// ============================================================================

import React, { useMemo } from 'react';
import { computeTextDiff } from '../lib/differ';
import type { LineDiff, ChangeType } from '../types';

interface SideBySideProps {
  oldContent: string;
  newContent: string;
  oldVersion?: string;
  newVersion?: string;
  showLineNumbers?: boolean;
  onLineClick?: (lineNumber: number, side: 'old' | 'new') => void;
}

export function SideBySide({
  oldContent,
  newContent,
  oldVersion = 'Old',
  newVersion = 'New',
  showLineNumbers = true,
  onLineClick,
}: SideBySideProps) {
  const diff = useMemo(
    () => computeTextDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  // Build paired lines for side-by-side view
  const pairedLines = useMemo(() => {
    const pairs: Array<{
      oldLine: LineDiff | null;
      newLine: LineDiff | null;
    }> = [];

    for (const hunk of diff.hunks) {
      const removedLines: LineDiff[] = [];
      const addedLines: LineDiff[] = [];
      const unchangedLines: LineDiff[] = [];

      for (const line of hunk.lines) {
        if (line.type === 'removed') {
          removedLines.push(line);
        } else if (line.type === 'added') {
          addedLines.push(line);
        } else {
          unchangedLines.push(line);
        }
      }

      // Pair removed/added lines
      const maxPairLength = Math.max(removedLines.length, addedLines.length);
      for (let i = 0; i < maxPairLength; i++) {
        pairs.push({
          oldLine: removedLines[i] || null,
          newLine: addedLines[i] || null,
        });
      }

      // Add unchanged lines
      for (const line of unchangedLines) {
        pairs.push({
          oldLine: line,
          newLine: line,
        });
      }
    }

    return pairs;
  }, [diff]);

  const getLineClass = (type: ChangeType | undefined): string => {
    switch (type) {
      case 'added':
        return 'bg-added-bg';
      case 'removed':
        return 'bg-removed-bg';
      default:
        return '';
    }
  };

  const getGutterClass = (type: ChangeType | undefined): string => {
    switch (type) {
      case 'added':
        return 'bg-added-line text-added-text';
      case 'removed':
        return 'bg-removed-line text-removed-text';
      default:
        return 'bg-gray-50 text-gray-500';
    }
  };

  return (
    <div className="font-mono text-sm border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="flex-1 px-4 py-2 border-r border-gray-200">
          <span className="font-semibold text-gray-700">{oldVersion}</span>
          <span className="ml-2 text-red-600">−{diff.deletions}</span>
        </div>
        <div className="flex-1 px-4 py-2">
          <span className="font-semibold text-gray-700">{newVersion}</span>
          <span className="ml-2 text-green-600">+{diff.additions}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex">
        {/* Old side */}
        <div className="flex-1 border-r border-gray-200 overflow-x-auto">
          {pairedLines.map((pair, index) => (
            <div
              key={`old-${index}`}
              className={`flex min-h-[24px] ${getLineClass(pair.oldLine?.type)}`}
              onClick={() =>
                pair.oldLine?.oldLineNumber &&
                onLineClick?.(pair.oldLine.oldLineNumber, 'old')
              }
            >
              {showLineNumbers && (
                <div
                  className={`w-12 px-2 text-right select-none flex-shrink-0 ${getGutterClass(
                    pair.oldLine?.type
                  )}`}
                >
                  {pair.oldLine?.oldLineNumber || ''}
                </div>
              )}
              <div
                className={`flex-1 px-2 whitespace-pre ${
                  pair.oldLine?.type === 'removed' ? 'text-removed-text' : ''
                }`}
              >
                {pair.oldLine?.type === 'removed' && (
                  <span className="select-none mr-1">−</span>
                )}
                {pair.oldLine?.content ?? ''}
              </div>
            </div>
          ))}
        </div>

        {/* New side */}
        <div className="flex-1 overflow-x-auto">
          {pairedLines.map((pair, index) => (
            <div
              key={`new-${index}`}
              className={`flex min-h-[24px] ${getLineClass(pair.newLine?.type)}`}
              onClick={() =>
                pair.newLine?.newLineNumber &&
                onLineClick?.(pair.newLine.newLineNumber, 'new')
              }
            >
              {showLineNumbers && (
                <div
                  className={`w-12 px-2 text-right select-none flex-shrink-0 ${getGutterClass(
                    pair.newLine?.type
                  )}`}
                >
                  {pair.newLine?.newLineNumber || ''}
                </div>
              )}
              <div
                className={`flex-1 px-2 whitespace-pre ${
                  pair.newLine?.type === 'added' ? 'text-added-text' : ''
                }`}
              >
                {pair.newLine?.type === 'added' && (
                  <span className="select-none mr-1">+</span>
                )}
                {pair.newLine?.content ?? ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SideBySide;
