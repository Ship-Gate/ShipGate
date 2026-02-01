'use client';

// ============================================================================
// Breaking Changes Panel
// Highlights breaking changes with detailed impact analysis
// ============================================================================

import React, { useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { computeSemanticDiff } from '../lib/differ';
import { classifyAllChanges, type ClassifiedChange } from '../lib/classifier';
import type { SemanticChange } from '../types';

interface BreakingChangesProps {
  oldContent: string;
  newContent: string;
  onChangeClick?: (change: SemanticChange) => void;
}

export function BreakingChanges({
  oldContent,
  newContent,
  onChangeClick,
}: BreakingChangesProps) {
  const { breakingChanges, warnings } = useMemo(() => {
    const changes = computeSemanticDiff(oldContent, newContent);
    return classifyAllChanges(changes);
  }, [oldContent, newContent]);

  const groupByEntity = (changes: ClassifiedChange[]) => {
    const groups = new Map<string, ClassifiedChange[]>();
    for (const change of changes) {
      const key = change.path.slice(0, 2).join('.');
      const existing = groups.get(key) || [];
      existing.push(change);
      groups.set(key, existing);
    }
    return groups;
  };

  const breakingGroups = groupByEntity(breakingChanges);
  const warningGroups = groupByEntity(warnings);

  if (breakingChanges.length === 0 && warnings.length === 0) {
    return (
      <div className="border border-green-200 rounded-lg bg-green-50 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-semibold">No breaking changes detected</span>
        </div>
        <p className="mt-2 text-sm text-green-600">
          This update is backward compatible and can be safely deployed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breaking Changes */}
      {breakingChanges.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 border-b border-red-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-900">
                {breakingChanges.length} Breaking Change
                {breakingChanges.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <p className="mt-1 text-sm text-red-700">
              These changes may break existing integrations or require data
              migrations.
            </p>
          </div>

          <div className="divide-y divide-red-100">
            {Array.from(breakingGroups.entries()).map(([group, changes]) => (
              <div key={group} className="bg-white">
                <div className="px-4 py-2 bg-red-25 border-b border-red-100">
                  <span className="text-sm font-medium text-red-800">
                    {group}
                  </span>
                </div>
                {changes.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => onChangeClick?.(change)}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-start gap-3"
                  >
                    <ChevronRight className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {formatChangeType(change.type)}
                        </span>
                        {change.location?.oldLine && (
                          <span className="text-xs text-gray-500">
                            Line {change.location.oldLine}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {change.description}
                      </p>

                      {/* Value change display */}
                      {(change.oldValue || change.newValue) && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-mono">
                          {change.oldValue && (
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                              {String(change.oldValue)}
                            </span>
                          )}
                          {change.oldValue && change.newValue && (
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                          )}
                          {change.newValue && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                              {String(change.newValue)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Impact info */}
                      <p className="mt-2 text-xs text-red-600">
                        ⚠️ {change.impact}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">
                {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <p className="mt-1 text-sm text-yellow-700">
              These changes should be reviewed but are unlikely to cause
              immediate issues.
            </p>
          </div>

          <div className="divide-y divide-yellow-100">
            {Array.from(warningGroups.entries()).map(([group, changes]) => (
              <div key={group} className="bg-white">
                <div className="px-4 py-2 bg-yellow-25 border-b border-yellow-100">
                  <span className="text-sm font-medium text-yellow-800">
                    {group}
                  </span>
                </div>
                {changes.map((change) => (
                  <button
                    key={change.id}
                    onClick={() => onChangeClick?.(change)}
                    className="w-full px-4 py-3 text-left hover:bg-yellow-50 transition-colors flex items-start gap-3"
                  >
                    <ChevronRight className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {formatChangeType(change.type)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {change.description}
                      </p>
                      <p className="mt-1 text-xs text-yellow-600">
                        ⚡ {change.impact}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Required Banner */}
      {breakingChanges.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 text-white">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Action Required</h4>
              <p className="mt-1 text-sm text-gray-300">
                This specification change includes {breakingChanges.length}{' '}
                breaking change{breakingChanges.length !== 1 ? 's' : ''}. Before
                deploying:
              </p>
              <ul className="mt-2 text-sm text-gray-300 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Review migration hints for each breaking change
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Update client applications and dependent services
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Plan data migrations if schema changes are involved
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  Update API documentation and notify consumers
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatChangeType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default BreakingChanges;
