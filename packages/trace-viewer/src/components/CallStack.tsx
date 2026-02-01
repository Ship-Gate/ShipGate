'use client';

import clsx from 'clsx';

interface CallStackProps {
  stack: string[];
  onFrameClick?: (index: number) => void;
}

export function CallStack({ stack, onFrameClick }: CallStackProps) {
  if (stack.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic">
        No active calls
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {stack.map((frame, index) => {
        const isTop = index === stack.length - 1;
        const depth = stack.length - index - 1;
        
        return (
          <div
            key={index}
            onClick={() => onFrameClick?.(index)}
            className={clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded text-sm font-mono',
              isTop ? 'bg-blue-100 border border-blue-200' : 'bg-gray-50',
              onFrameClick && 'cursor-pointer hover:bg-blue-50'
            )}
            style={{ marginLeft: `${depth * 8}px` }}
          >
            {/* Stack indicator */}
            <span className="text-gray-400 text-xs w-4">
              #{stack.length - index}
            </span>

            {/* Function name */}
            <span className={clsx(
              'flex-1',
              isTop ? 'text-blue-700 font-medium' : 'text-gray-700'
            )}>
              {frame}
            </span>

            {/* Current indicator */}
            {isTop && (
              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                current
              </span>
            )}

            {/* Arrow indicator */}
            <span className="text-gray-400">
              {isTop ? '→' : '↳'}
            </span>
          </div>
        );
      })}

      {/* Visual stack representation */}
      <div className="mt-3 flex items-end gap-1 h-16">
        {stack.map((frame, index) => {
          const isTop = index === stack.length - 1;
          const height = ((index + 1) / stack.length) * 100;
          
          return (
            <div
              key={index}
              className={clsx(
                'flex-1 rounded-t transition-all',
                isTop ? 'bg-blue-500' : 'bg-gray-300'
              )}
              style={{ height: `${height}%` }}
              title={frame}
            />
          );
        })}
      </div>

      {/* Stack depth indicator */}
      <div className="text-xs text-gray-500 text-center">
        Stack depth: {stack.length}
      </div>
    </div>
  );
}

interface DetailedCallStackProps {
  frames: Array<{
    function: string;
    file?: string;
    line?: number;
    variables?: Record<string, unknown>;
  }>;
  currentFrame?: number;
  onFrameSelect?: (index: number) => void;
}

export function DetailedCallStack({ 
  frames, 
  currentFrame = 0, 
  onFrameSelect 
}: DetailedCallStackProps) {
  if (frames.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic p-4 text-center">
        No call stack available
      </div>
    );
  }

  return (
    <div className="divide-y">
      {frames.map((frame, index) => {
        const isActive = index === currentFrame;
        
        return (
          <div
            key={index}
            onClick={() => onFrameSelect?.(index)}
            className={clsx(
              'p-3 transition-colors',
              isActive ? 'bg-blue-50' : 'hover:bg-gray-50',
              onFrameSelect && 'cursor-pointer'
            )}
          >
            {/* Frame header */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">
                #{frames.length - index}
              </span>
              <span className={clsx(
                'font-mono font-medium',
                isActive ? 'text-blue-700' : 'text-gray-800'
              )}>
                {frame.function}()
              </span>
              {isActive && (
                <span className="ml-auto text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                  active
                </span>
              )}
            </div>

            {/* File location */}
            {frame.file && (
              <div className="mt-1 text-xs text-gray-500 pl-6">
                {frame.file}
                {frame.line && `:${frame.line}`}
              </div>
            )}

            {/* Variables preview */}
            {frame.variables && Object.keys(frame.variables).length > 0 && isActive && (
              <div className="mt-2 pl-6">
                <div className="text-xs text-gray-500 mb-1">Local variables:</div>
                <div className="bg-gray-100 rounded p-2 text-xs font-mono">
                  {Object.entries(frame.variables).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-purple-600">{key}</span>
                      <span className="text-gray-400">=</span>
                      <span className="text-green-600 truncate">
                        {JSON.stringify(value)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(frame.variables).length > 5 && (
                    <div className="text-gray-400">
                      ...{Object.keys(frame.variables).length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
