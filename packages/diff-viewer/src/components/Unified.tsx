'use client';

// ============================================================================
// Unified Diff View
// ============================================================================

import React, { useMemo } from 'react';
import { computeTextDiff } from '../lib/differ';
import type { ChangeType } from '../types';

interface UnifiedProps {
  oldContent: string;
  newContent: string;
  oldVersion?: string;
  newVersion?: string;
  showLineNumbers?: boolean;
  contextLines?: number;
  onLineClick?: (lineNumber: number, type: 'old' | 'new') => void;
}

export function Unified({
  oldContent,
  newContent,
  oldVersion = 'Old',
  newVersion = 'New',
  showLineNumbers = true,
  contextLines = 3,
  onLineClick,
}: UnifiedProps) {
  const diff = useMemo(
    () => computeTextDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const getLineClass = (type: ChangeType): string => {
    switch (type) {
      case 'added':
        return 'bg-added-bg';
      case 'removed':
        return 'bg-removed-bg';
      default:
        return '';
    }
  };

  const getGutterClass = (type: ChangeType): string => {
    switch (type) {
      case 'added':
        return 'bg-added-line text-added-text';
      case 'removed':
        return 'bg-removed-line text-removed-text';
      default:
        return 'bg-gray-50 text-gray-500';
    }
  };

  const getPrefix = (type: ChangeType): string => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '−';
      default:
        return ' ';
    }
  };

  return (
    <div className="font-mono text-sm border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="font-semibold text-gray-700">
          {oldVersion} → {newVersion}
        </span>
        <span className="ml-4 text-red-600">−{diff.deletions}</span>
        <span className="ml-2 text-green-600">+{diff.additions}</span>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto">
        {diff.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex}>
            {/* Hunk header */}
            <div className="bg-blue-50 text-blue-700 px-4 py-1 text-xs border-b border-gray-200">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>

            {/* Hunk lines */}
            {hunk.lines.map((line, lineIndex) => (
              <div
                key={`${hunkIndex}-${lineIndex}`}
                className={`flex min-h-[24px] ${getLineClass(line.type)} cursor-pointer hover:brightness-95`}
                onClick={() => {
                  const lineNum = line.type === 'removed' ? line.oldLineNumber : line.newLineNumber;
                  const type = line.type === 'removed' ? 'old' : 'new';
                  if (lineNum) onLineClick?.(lineNum, type);
                }}
              >
                {showLineNumbers && (
                  <>
                    {/* Old line number */}
                    <div
                      className={`w-12 px-2 text-right select-none flex-shrink-0 border-r border-gray-200 ${getGutterClass(
                        line.type
                      )}`}
                    >
                      {line.type !== 'added' ? line.oldLineNumber : ''}
                    </div>
                    {/* New line number */}
                    <div
                      className={`w-12 px-2 text-right select-none flex-shrink-0 border-r border-gray-200 ${getGutterClass(
                        line.type
                      )}`}
                    >
                      {line.type !== 'removed' ? line.newLineNumber : ''}
                    </div>
                  </>
                )}

                {/* Prefix */}
                <div
                  className={`w-6 text-center select-none flex-shrink-0 ${
                    line.type === 'added'
                      ? 'text-added-text'
                      : line.type === 'removed'
                      ? 'text-removed-text'
                      : 'text-gray-400'
                  }`}
                >
                  {getPrefix(line.type)}
                </div>

                {/* Content */}
                <div
                  className={`flex-1 px-2 whitespace-pre ${
                    line.type === 'added'
                      ? 'text-added-text'
                      : line.type === 'removed'
                      ? 'text-removed-text'
                      : ''
                  }`}
                >
                  {line.content}
                </div>
              </div>
            ))}
          </div>
        ))}

        {diff.hunks.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            No differences found
          </div>
        )}
      </div>
    </div>
  );
}

export default Unified;
