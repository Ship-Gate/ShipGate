'use client';

// ============================================================================
// ISL Diff Viewer - Main Page
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Columns,
  AlignJustify,
  Layers,
  AlertTriangle,
  Lightbulb,
  Upload,
  Download,
  Settings,
} from 'lucide-react';
import { SideBySide } from '../components/SideBySide';
import { Unified } from '../components/Unified';
import { SemanticDiff } from '../components/SemanticDiff';
import { BreakingChanges } from '../components/BreakingChanges';
import { MigrationHints } from '../components/MigrationHints';
import { generateDiffSummary } from '../lib/differ';
import type { DiffViewMode, SemanticChange } from '../types';

// Sample ISL for demonstration
const SAMPLE_OLD = `domain Auth {
  version: "1.0.0"
  
  type Email = String {
    format: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    max_length: 254
  }
  
  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    name: String
    status: UserStatus
    created_at: Timestamp [immutable]
  }
  
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
  }
  
  behavior Login {
    input {
      email: Email
      password: String [sensitive]
    }
    
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { }
        ACCOUNT_LOCKED { }
      }
    }
    
    preconditions {
      input.email.is_valid
    }
  }
}`;

const SAMPLE_NEW = `domain Auth {
  version: "2.0.0"
  
  type Email = String {
    format: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    max_length: 320
  }
  
  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    display_name: String
    status: UserStatus
    created_at: Timestamp [immutable]
    last_login: Timestamp?
    mfa_enabled: Boolean
  }
  
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
    DELETED
  }
  
  behavior Login {
    input {
      email: Email
      password: String [sensitive]
      mfa_code: String?
    }
    
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { }
        ACCOUNT_LOCKED { }
        MFA_REQUIRED { }
      }
    }
    
    preconditions {
      input.email.is_valid
      input.password.length >= 8
    }
    
    security {
      rate_limit 10/minute per input.email
    }
  }
}`;

type TabType = 'diff' | 'breaking' | 'migration';

export default function DiffViewerPage() {
  const [oldContent, setOldContent] = useState(SAMPLE_OLD);
  const [newContent, setNewContent] = useState(SAMPLE_NEW);
  const [viewMode, setViewMode] = useState<DiffViewMode>('side-by-side');
  const [activeTab, setActiveTab] = useState<TabType>('diff');
  const [selectedChange, setSelectedChange] = useState<SemanticChange | null>(null);
  const [showBreakingOnly, setShowBreakingOnly] = useState(false);

  const summary = useMemo(
    () => generateDiffSummary(oldContent, newContent),
    [oldContent, newContent]
  );

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'old' | 'new'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (target === 'old') {
        setOldContent(content);
      } else {
        setNewContent(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: summary.totalChanges,
        breakingChanges: summary.breakingChanges,
        warnings: summary.warnings,
      },
      changes: summary.semanticChanges,
      migrationHints: summary.migrationHints,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'isl-diff-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">ISL Diff Viewer</h1>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                  v1.0.0
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-blue-100 rounded text-blue-700">
                  v2.0.0
                </span>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600">+{summary.additions}</span>
                <span className="text-red-600">−{summary.deletions}</span>
                {summary.breakingChanges > 0 && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                    {summary.breakingChanges} breaking
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <label className="cursor-pointer px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center gap-1">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload</span>
                  <input
                    type="file"
                    accept=".isl,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'old')}
                  />
                </label>
                <button
                  onClick={handleExport}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 mt-4 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setActiveTab('diff')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === 'diff'
                  ? 'tab-active'
                  : 'tab-inactive'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Diff View
              </span>
            </button>
            <button
              onClick={() => setActiveTab('breaking')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === 'breaking'
                  ? 'tab-active'
                  : 'tab-inactive'
              }`}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Breaking Changes
                {summary.breakingChanges > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                    {summary.breakingChanges}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('migration')}
              className={`pb-3 px-1 text-sm font-medium transition-colors ${
                activeTab === 'migration'
                  ? 'tab-active'
                  : 'tab-inactive'
              }`}
            >
              <span className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Migration Guide
                {summary.migrationHints.length > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                    {summary.migrationHints.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'diff' && (
          <>
            {/* View Mode Selector */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('side-by-side')}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
                    viewMode === 'side-by-side'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Columns className="w-4 h-4" />
                  Side by Side
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
                    viewMode === 'unified'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <AlignJustify className="w-4 h-4" />
                  Unified
                </button>
                <button
                  onClick={() => setViewMode('semantic')}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors flex items-center gap-2 ${
                    viewMode === 'semantic'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Semantic
                </button>
              </div>

              {viewMode === 'semantic' && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBreakingOnly}
                    onChange={(e) => setShowBreakingOnly(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Show breaking only
                </label>
              )}
            </div>

            {/* Diff Content */}
            <div className="bg-white rounded-lg shadow-sm">
              {viewMode === 'side-by-side' && (
                <SideBySide
                  oldContent={oldContent}
                  newContent={newContent}
                  oldVersion="v1.0.0"
                  newVersion="v2.0.0"
                />
              )}
              {viewMode === 'unified' && (
                <Unified
                  oldContent={oldContent}
                  newContent={newContent}
                  oldVersion="v1.0.0"
                  newVersion="v2.0.0"
                />
              )}
              {viewMode === 'semantic' && (
                <SemanticDiff
                  oldContent={oldContent}
                  newContent={newContent}
                  onChangeSelect={setSelectedChange}
                  selectedChangeId={selectedChange?.id}
                  showOnlyBreaking={showBreakingOnly}
                />
              )}
            </div>
          </>
        )}

        {activeTab === 'breaking' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <BreakingChanges
              oldContent={oldContent}
              newContent={newContent}
              onChangeClick={(change) => {
                setSelectedChange(change);
                setActiveTab('diff');
                setViewMode('semantic');
              }}
            />
          </div>
        )}

        {activeTab === 'migration' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <MigrationHints
              oldContent={oldContent}
              newContent={newContent}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>ISL Diff Viewer v0.1.0</span>
            <div className="flex items-center gap-4">
              <span>
                {summary.totalChanges} total changes
              </span>
              <span>•</span>
              <span className="text-green-600">+{summary.additions} additions</span>
              <span className="text-red-600">−{summary.deletions} deletions</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
