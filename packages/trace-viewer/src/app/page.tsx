'use client';

import { useEffect, useState } from 'react';
import { useTracePlayer } from '@/lib/player';
import { createSampleTrace, createFailingSampleTrace, getTraceStats } from '@/lib/trace';
import { Controls } from '@/components/Controls';
import { TraceTimeline } from '@/components/TraceTimeline';
import { StateInspector } from '@/components/StateInspector';
import { CallStack } from '@/components/CallStack';
import { ExpressionEval } from '@/components/ExpressionEval';
import { DiffViewer } from '@/components/DiffViewer';
import type { Trace } from '@/types';

export default function TracePage() {
  const { trace, loadTrace, filteredEvents, currentIndex, currentState, previousState, stateDiff, callStack } = useTracePlayer();
  const [showDiff, setShowDiff] = useState(false);

  // Load sample trace on mount
  useEffect(() => {
    loadTrace(createSampleTrace());
  }, [loadTrace]);

  const currentEvent = filteredEvents[currentIndex];
  const stats = trace ? getTraceStats(trace) : null;

  const handleLoadSample = (type: 'passing' | 'failing') => {
    if (type === 'passing') {
      loadTrace(createSampleTrace());
    } else {
      loadTrace(createFailingSampleTrace());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        loadTrace(parsed as Trace);
      } catch (err) {
        alert('Invalid trace file format');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-900">
            🔍 Trace Viewer
          </h1>
          {trace && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{trace.name}</span>
              <span className="text-gray-400">|</span>
              <span>{trace.domain}</span>
              {trace.metadata.passed ? (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  PASSED
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  FAILED
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleLoadSample('passing')}
            className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
          >
            Load Passing
          </button>
          <button
            onClick={() => handleLoadSample('failing')}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 transition"
          >
            Load Failing
          </button>
          <label className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition cursor-pointer">
            Upload Trace
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* Controls */}
      <Controls />

      {/* Timeline */}
      <div className="h-28 bg-white border-b">
        <TraceTimeline />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: State Inspector */}
        <div className="w-1/3 border-r bg-white overflow-hidden flex flex-col">
          <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50">
            <h3 className="font-semibold text-gray-700">State</h3>
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={`px-2 py-1 text-xs rounded ${
                showDiff ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {showDiff && stateDiff.length > 0 ? (
              <DiffViewer diffs={stateDiff} />
            ) : (
              <StateInspector state={currentState} previousState={previousState} />
            )}
          </div>
        </div>

        {/* Center: Event Details */}
        <div className="w-1/3 border-r bg-white overflow-hidden flex flex-col">
          <div className="h-10 border-b flex items-center px-4 bg-gray-50">
            <h3 className="font-semibold text-gray-700">
              Event: <span className="text-blue-600">{currentEvent?.type ?? 'none'}</span>
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {currentEvent ? (
              <div className="space-y-4">
                {/* Event info */}
                <div className="text-sm text-gray-500">
                  ID: {currentEvent.id} | Time: {currentEvent.timestamp}ms
                </div>

                {/* Event data */}
                <pre className="text-sm bg-gray-50 p-3 rounded border overflow-auto max-h-48">
                  {JSON.stringify(currentEvent.data, null, 2)}
                </pre>

                {/* Check result banner */}
                {currentEvent.type === 'check' && currentEvent.data.kind === 'check' && (
                  <div
                    className={`p-3 rounded ${
                      (currentEvent.data as { passed: boolean }).passed
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {(currentEvent.data as { passed: boolean }).passed ? (
                        <>
                          <span className="text-green-600">✓</span>
                          <span className="text-green-700">Check Passed</span>
                        </>
                      ) : (
                        <>
                          <span className="text-red-600">✗</span>
                          <span className="text-red-700">Check Failed</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm mt-1 font-mono">
                      {(currentEvent.data as { expression: string }).expression}
                    </p>
                    {(currentEvent.data as { message?: string }).message && (
                      <p className="text-sm mt-2 text-gray-600">
                        {(currentEvent.data as { message: string }).message}
                      </p>
                    )}
                  </div>
                )}

                {/* Error banner */}
                {currentEvent.type === 'error' && currentEvent.data.kind === 'error' && (
                  <div className="p-3 rounded bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2 font-medium text-red-700">
                      <span>⚠️</span>
                      <span>Error</span>
                    </div>
                    <p className="text-sm mt-1 font-mono text-red-600">
                      {(currentEvent.data as { message: string }).message}
                    </p>
                  </div>
                )}

                {/* Call Stack */}
                {callStack.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">Call Stack</h4>
                    <CallStack stack={callStack} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">
                No event selected
              </div>
            )}
          </div>
        </div>

        {/* Right: Expression Evaluator + Stats */}
        <div className="w-1/3 bg-white overflow-hidden flex flex-col">
          <div className="h-10 border-b flex items-center px-4 bg-gray-50">
            <h3 className="font-semibold text-gray-700">Expression Evaluator</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <ExpressionEval state={currentState} />

            {/* Stats */}
            {stats && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium text-gray-700 mb-3">Trace Statistics</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">Total Events</div>
                    <div className="font-semibold">{stats.totalEvents}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">Duration</div>
                    <div className="font-semibold">{stats.duration}ms</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <div className="text-green-600">Passed Checks</div>
                    <div className="font-semibold text-green-700">{stats.passedChecks}</div>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <div className="text-red-600">Failed Checks</div>
                    <div className="font-semibold text-red-700">{stats.failedChecks}</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded col-span-2">
                    <div className="text-blue-600">State Changes</div>
                    <div className="font-semibold text-blue-700">{stats.stateChanges}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
