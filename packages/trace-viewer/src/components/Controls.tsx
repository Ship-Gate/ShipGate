'use client';

import { useTracePlayer } from '@/lib/player';
import type { EventType } from '@/types';

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'call', label: 'Call', color: 'bg-yellow-500' },
  { value: 'return', label: 'Return', color: 'bg-purple-500' },
  { value: 'state_change', label: 'State', color: 'bg-blue-500' },
  { value: 'check', label: 'Check', color: 'bg-green-500' },
  { value: 'error', label: 'Error', color: 'bg-red-500' },
];

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export function Controls() {
  const {
    trace,
    filteredEvents,
    currentIndex,
    playing,
    speed,
    looping,
    filter,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBack,
    jumpToStart,
    jumpToEnd,
    jumpToFailure,
    setSpeed,
    setLooping,
    setFilter,
  } = useTracePlayer();

  if (!trace) {
    return (
      <div className="h-14 bg-white border-b flex items-center justify-center text-gray-400">
        Load a trace to begin
      </div>
    );
  }

  const hasFailure = trace.metadata.failureIndex !== undefined;

  return (
    <div className="h-14 bg-white border-b flex items-center px-4 gap-6">
      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={jumpToStart}
          disabled={currentIndex === 0}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Jump to start"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm10.293.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" transform="scale(-1, 1) translate(-20, 0)" />
          </svg>
        </button>

        <button
          onClick={stepBack}
          disabled={currentIndex === 0}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Step back"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
          </svg>
        </button>

        <button
          onClick={togglePlay}
          className="p-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <button
          onClick={stepForward}
          disabled={currentIndex >= filteredEvents.length - 1}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Step forward"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
          </svg>
        </button>

        <button
          onClick={jumpToEnd}
          disabled={currentIndex >= filteredEvents.length - 1}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
          title="Jump to end"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4.293 15.707a1 1 0 010-1.414L6.586 12H4a1 1 0 110-2h2.586L4.293 7.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0zM12 4a1 1 0 011 1v10a1 1 0 11-2 0V5a1 1 0 011-1z" />
          </svg>
        </button>

        {hasFailure && (
          <button
            onClick={jumpToFailure}
            className="ml-2 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition flex items-center gap-1"
            title="Jump to first failure"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Jump to Failure
          </button>
        )}
      </div>

      {/* Position indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-600 border-l pl-6">
        <span className="font-mono">
          {currentIndex + 1} / {filteredEvents.length}
        </span>
        {filteredEvents[currentIndex] && (
          <span className="text-gray-400">
            ({filteredEvents[currentIndex].timestamp}ms)
          </span>
        )}
      </div>

      {/* Speed control */}
      <div className="flex items-center gap-2 border-l pl-6">
        <span className="text-sm text-gray-500">Speed:</span>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="text-sm border rounded px-2 py-1 bg-white"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-600 ml-2">
          <input
            type="checkbox"
            checked={looping}
            onChange={(e) => setLooping(e.target.checked)}
            className="rounded"
          />
          Loop
        </label>
      </div>

      {/* Event type filters */}
      <div className="flex items-center gap-2 border-l pl-6 ml-auto">
        <span className="text-sm text-gray-500">Filter:</span>
        {EVENT_TYPES.map(({ value, label, color }) => (
          <button
            key={value}
            onClick={() => {
              const current = filter.eventTypes;
              const newTypes = current.includes(value)
                ? current.filter((t) => t !== value)
                : [...current, value];
              setFilter({ eventTypes: newTypes });
            }}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
              filter.eventTypes.length === 0 || filter.eventTypes.includes(value)
                ? 'opacity-100'
                : 'opacity-40'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="border-l pl-4">
        <input
          type="text"
          placeholder="Search events..."
          value={filter.searchQuery}
          onChange={(e) => setFilter({ searchQuery: e.target.value })}
          className="text-sm border rounded px-3 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
