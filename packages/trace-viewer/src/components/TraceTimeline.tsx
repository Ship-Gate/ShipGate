'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTracePlayer } from '@/lib/player';
import clsx from 'clsx';
import type { TraceEvent, CheckEventData } from '@/types';

const EVENT_COLORS: Record<string, string> = {
  call: 'bg-yellow-400 hover:bg-yellow-500',
  return: 'bg-purple-400 hover:bg-purple-500',
  state_change: 'bg-blue-400 hover:bg-blue-500',
  check: 'bg-green-400 hover:bg-green-500',
  check_failed: 'bg-red-500 hover:bg-red-600',
  error: 'bg-orange-500 hover:bg-orange-600',
  invariant: 'bg-cyan-400 hover:bg-cyan-500',
  postcondition: 'bg-emerald-400 hover:bg-emerald-500',
  precondition: 'bg-lime-400 hover:bg-lime-500',
  temporal: 'bg-indigo-400 hover:bg-indigo-500',
};

function getEventColor(event: TraceEvent): string {
  if (event.type === 'check' && event.data.kind === 'check') {
    const checkData = event.data as CheckEventData;
    return checkData.passed ? (EVENT_COLORS['check'] ?? 'bg-green-400') : (EVENT_COLORS['check_failed'] ?? 'bg-red-500');
  }
  const key = event.type ?? 'state_change';
  return (EVENT_COLORS as Record<string, string>)[key] ?? 'bg-gray-400';
}

export function TraceTimeline() {
  const { filteredEvents, currentIndex, jumpTo, trace } = useTracePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [_dragStart, _setDragStart] = useState<number | null>(null);

  // Auto-scroll to current event
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const eventElements = container.querySelectorAll('[data-event-index]');
    const currentElement = eventElements[currentIndex] as HTMLElement;
    
    if (currentElement) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = currentElement.getBoundingClientRect();
      
      if (elementRect.left < containerRect.left || elementRect.right > containerRect.right) {
        currentElement.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.5, Math.min(3, z * delta)));
    }
  }, []);

  if (!trace || filteredEvents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No events to display
      </div>
    );
  }

  const maxTimestamp = filteredEvents[filteredEvents.length - 1]?.timestamp ?? 1;
  const minGap = 20 * zoom;

  return (
    <div className="h-full flex flex-col">
      {/* Timeline header */}
      <div className="h-8 border-b flex items-center justify-between px-4 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Timeline</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
              className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300"
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
              className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span>0ms</span>
          <span className="text-gray-300">→</span>
          <span>{maxTimestamp}ms</span>
        </div>
      </div>

      {/* Timeline content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        onWheel={handleWheel}
      >
        <div 
          className="h-full flex items-center px-4 min-w-max"
          style={{ gap: `${minGap}px` }}
        >
          {filteredEvents.map((event, index) => {
            const isActive = index === currentIndex;
            const isFailed = event.type === 'check' && 
              event.data.kind === 'check' && 
              !(event.data as CheckEventData).passed;

            return (
              <div
                key={event.id}
                data-event-index={index}
                onClick={() => jumpTo(index)}
                className="relative group"
              >
                {/* Event dot */}
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full cursor-pointer transition-all duration-150',
                    getEventColor(event),
                    isActive && 'ring-2 ring-offset-2 ring-blue-500 scale-125',
                    !isActive && 'hover:scale-110'
                  )}
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                />

                {/* Failure marker */}
                {isFailed && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                )}

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    <div className="font-medium">{event.type}</div>
                    <div className="text-gray-400">{event.timestamp}ms</div>
                    {event.type === 'check' && event.data.kind === 'check' && (
                      <div className={isFailed ? 'text-red-400' : 'text-green-400'}>
                        {(event.data as CheckEventData).passed ? '✓ Passed' : '✗ Failed'}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>

                {/* Connecting line */}
                {index < filteredEvents.length - 1 && (
                  <div
                    className="absolute top-1/2 left-full h-px bg-gray-300"
                    style={{ width: `${minGap}px` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="h-6 border-t flex items-center justify-center gap-4 bg-gray-50 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400" /> Call
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400" /> Return
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> State
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" /> Pass
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Fail
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Error
        </span>
      </div>
    </div>
  );
}
