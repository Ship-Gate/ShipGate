'use client';

// ============================================================================
// Semantic Diff View
// Shows structural changes rather than text changes
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Minus,
  Edit,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Code,
  FileText,
  Shield,
} from 'lucide-react';
import { computeSemanticDiff } from '../lib/differ';
import {
  classifyAllChanges,
  getCategoryLabel,
  getBreakingLevelColor,
  type ChangeCategory,
  type ClassifiedChange,
} from '../lib/classifier';
import type { SemanticChange, BreakingChangeLevel } from '../types';

interface SemanticDiffProps {
  oldContent: string;
  newContent: string;
  onChangeSelect?: (change: SemanticChange) => void;
  selectedChangeId?: string | null;
  showOnlyBreaking?: boolean;
}

export function SemanticDiff({
  oldContent,
  newContent,
  onChangeSelect,
  selectedChangeId,
  showOnlyBreaking = false,
}: SemanticDiffProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<ChangeCategory>>(
    new Set(['schema', 'behavior', 'contract', 'policy'])
  );

  const classification = useMemo(() => {
    const changes = computeSemanticDiff(oldContent, newContent);
    return classifyAllChanges(changes);
  }, [oldContent, newContent]);

  const toggleCategory = (category: ChangeCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: ChangeCategory) => {
    switch (category) {
      case 'schema':
        return <Database className="w-4 h-4" />;
      case 'behavior':
        return <Code className="w-4 h-4" />;
      case 'contract':
        return <FileText className="w-4 h-4" />;
      case 'policy':
        return <Shield className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getChangeIcon = (change: ClassifiedChange) => {
    if (change.type.includes('added')) {
      return <Plus className="w-4 h-4 text-green-600" />;
    }
    if (change.type.includes('removed')) {
      return <Minus className="w-4 h-4 text-red-600" />;
    }
    return <Edit className="w-4 h-4 text-yellow-600" />;
  };

  const getBreakingIcon = (level: BreakingChangeLevel) => {
    switch (level) {
      case 'breaking':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'safe':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getRiskColor = (score: number): string => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const filteredCategories = showOnlyBreaking
    ? new Map(
        Array.from(classification.categories.entries()).map(([cat, changes]) => [
          cat,
          changes.filter((c) => c.breakingLevel === 'breaking'),
        ])
      )
    : classification.categories;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Summary Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-900">
              {classification.summary.totalChanges} Changes
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="w-3 h-3" />
                {classification.summary.byLevel.breaking} Breaking
              </span>
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="w-3 h-3" />
                {classification.summary.byLevel.warning} Warnings
              </span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {classification.summary.byLevel.safe} Safe
              </span>
            </div>
          </div>

          {/* Risk Score */}
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(
              classification.summary.riskScore
            )}`}
          >
            Risk Score: {classification.summary.riskScore}
          </div>
        </div>
      </div>

      {/* Changes by Category */}
      <div className="divide-y divide-gray-200">
        {Array.from(filteredCategories.entries()).map(([category, changes]) => {
          if (changes.length === 0) return null;

          const isExpanded = expandedCategories.has(category);
          const breakingCount = changes.filter(
            (c) => c.breakingLevel === 'breaking'
          ).length;

          return (
            <div key={category}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  {getCategoryIcon(category)}
                  <span className="font-medium text-gray-900">
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({changes.length} changes)
                  </span>
                </div>
                {breakingCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {breakingCount} breaking
                  </span>
                )}
              </button>

              {/* Changes List */}
              {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200">
                  {changes.map((change) => (
                    <button
                      key={change.id}
                      onClick={() => onChangeSelect?.(change)}
                      className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-white transition-colors border-b border-gray-100 last:border-b-0 ${
                        selectedChangeId === change.id
                          ? 'bg-blue-50 border-l-2 border-l-blue-500'
                          : ''
                      }`}
                    >
                      {/* Change Icon */}
                      <div className="mt-0.5">{getChangeIcon(change)}</div>

                      {/* Change Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {change.path.join(' > ')}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getBreakingLevelColor(
                              change.breakingLevel
                            )}`}
                          >
                            {change.breakingLevel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {change.description}
                        </p>
                        {change.impact && (
                          <p className="mt-1 text-xs text-gray-500">
                            Impact: {change.impact}
                          </p>
                        )}
                        {change.affectedComponents.length > 0 && (
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {change.affectedComponents.map((comp) => (
                              <span
                                key={comp}
                                className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded"
                              >
                                {comp}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Breaking Level Icon */}
                      <div className="mt-0.5">
                        {getBreakingIcon(change.breakingLevel)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {classification.summary.totalChanges === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            No semantic changes detected
          </div>
        )}
      </div>
    </div>
  );
}

export default SemanticDiff;
