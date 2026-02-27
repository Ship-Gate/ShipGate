'use client';

// ============================================================================
// Migration Hints Panel
// Provides actionable migration guidance for breaking changes
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  Lightbulb,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  AlertCircle,
  Code,
  Copy,
  Check,
} from 'lucide-react';
import { generateDiffSummary } from '../lib/differ';
import type { MigrationHint, MigrationStep } from '../types';

interface MigrationHintsProps {
  oldContent: string;
  newContent: string;
  onHintClick?: (hint: MigrationHint) => void;
}

export function MigrationHints({
  oldContent,
  newContent,
  onHintClick,
}: MigrationHintsProps) {
  const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const summary = useMemo(
    () => generateDiffSummary(oldContent, newContent),
    [oldContent, newContent]
  );

  const toggleHint = (id: string) => {
    setExpandedHints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStep = (hintId: string, stepOrder: number) => {
    const key = `${hintId}-${stepOrder}`;
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityColor = (severity: MigrationHint['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'high':
        return 'border-orange-200 bg-orange-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getSeverityBadge = (severity: MigrationHint['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getCompletionPercentage = (hint: MigrationHint): number => {
    const totalSteps = hint.steps.length;
    if (totalSteps === 0) return 100;

    const completedCount = hint.steps.filter((step) =>
      completedSteps.has(`${hint.id}-${step.order}`)
    ).length;

    return Math.round((completedCount / totalSteps) * 100);
  };

  if (summary.migrationHints.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center bg-gray-50">
        <Lightbulb className="w-8 h-8 text-gray-400 mx-auto" />
        <h3 className="mt-2 font-medium text-gray-900">No migration required</h3>
        <p className="mt-1 text-sm text-gray-500">
          All changes are backward compatible. No special migration steps needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900">Migration Guide</h3>
          <span className="text-sm text-gray-500">
            ({summary.migrationHints.length} hint
            {summary.migrationHints.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>

      {/* Hints List */}
      <div className="space-y-3">
        {summary.migrationHints.map((hint) => {
          const isExpanded = expandedHints.has(hint.id);
          const completion = getCompletionPercentage(hint);

          return (
            <div
              key={hint.id}
              className={`border rounded-lg overflow-hidden ${getSeverityColor(
                hint.severity
              )}`}
            >
              {/* Hint Header */}
              <button
                onClick={() => {
                  toggleHint(hint.id);
                  onHintClick?.(hint);
                }}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:brightness-95 transition-all"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {hint.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityBadge(
                        hint.severity
                      )}`}
                    >
                      {hint.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{hint.description}</p>

                  {/* Progress bar */}
                  {hint.steps.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            completion === 100
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {completion}%
                      </span>
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0">
                  {/* Steps */}
                  {hint.steps.length > 0 && (
                    <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                      {hint.steps.map((step) => {
                        const stepKey = `${hint.id}-${step.order}`;
                        const isCompleted = completedSteps.has(stepKey);

                        return (
                          <div
                            key={step.order}
                            className="flex items-start gap-3 p-3"
                          >
                            <button
                              onClick={() => toggleStep(hint.id, step.order)}
                              className="mt-0.5 flex-shrink-0"
                            >
                              {isCompleted ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <Circle className="w-5 h-5 text-gray-300" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-medium ${
                                    isCompleted
                                      ? 'text-gray-400 line-through'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {step.order}. {step.title}
                                </span>
                                {step.required && (
                                  <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p
                                className={`mt-1 text-sm ${
                                  isCompleted
                                    ? 'text-gray-400'
                                    : 'text-gray-600'
                                }`}
                              >
                                {step.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Code Example */}
                  {hint.codeExample && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Code className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          Code Example
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Before */}
                        <div className="border border-red-200 rounded-lg overflow-hidden">
                          <div className="bg-red-50 px-3 py-1.5 border-b border-red-200 flex items-center justify-between">
                            <span className="text-xs font-medium text-red-700">
                              Before
                            </span>
                          </div>
                          <pre className="p-3 text-xs font-mono bg-white overflow-x-auto">
                            {hint.codeExample.before}
                          </pre>
                        </div>

                        {/* After */}
                        <div className="border border-green-200 rounded-lg overflow-hidden">
                          <div className="bg-green-50 px-3 py-1.5 border-b border-green-200 flex items-center justify-between">
                            <span className="text-xs font-medium text-green-700">
                              After
                            </span>
                            <button
                              onClick={() =>
                                copyCode(
                                  hint.codeExample!.after,
                                  `${hint.id}-code`
                                )
                              }
                              className="text-green-600 hover:text-green-800"
                            >
                              {copiedId === `${hint.id}-code` ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <pre className="p-3 text-xs font-mono bg-white overflow-x-auto">
                            {hint.codeExample.after}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Related Changes */}
                  {hint.changeIds.length > 0 && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>
                        Affects {hint.changeIds.length} change
                        {hint.changeIds.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MigrationHints;
