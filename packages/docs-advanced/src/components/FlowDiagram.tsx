// ============================================================================
// FlowDiagram Component - Render flow/sequence diagrams
// ============================================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface FlowDiagramProps {
  /** Mermaid diagram code */
  diagram: string;
  
  /** Diagram type for styling */
  type?: 'sequence' | 'flowchart' | 'state' | 'er';
  
  /** Title */
  title?: string;
  
  /** Theme */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  
  /** Enable zoom */
  zoomable?: boolean;
  
  /** Show source toggle */
  showSource?: boolean;
  
  /** Custom styles */
  className?: string;
}

export function FlowDiagram({
  diagram,
  type = 'flowchart',
  title,
  theme = 'default',
  zoomable = true,
  showSource = true,
  className = '',
}: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderDiagram = async () => {
      try {
        // In production, use mermaid library
        // For now, we'll render a placeholder
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = diagram;
        
        containerRef.current!.innerHTML = '';
        containerRef.current!.appendChild(mermaidDiv);

        // Check if mermaid is available globally
        if (typeof window !== 'undefined' && (window as unknown as { mermaid?: { init: () => void } }).mermaid) {
          (window as unknown as { mermaid: { init: () => void } }).mermaid.init();
        }

        setRendered(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
        setRendered(false);
      }
    };

    renderDiagram();
  }, [diagram, theme]);

  const handleZoomIn = () => setScale((s: number) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s: number) => Math.max(s - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  return (
    <div className={`flowdiagram-container border rounded-lg overflow-hidden my-6 ${className}`}>
      {/* Header */}
      <div className="flowdiagram-header bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          {title && <h4 className="font-medium text-gray-800">{title}</h4>}
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
            {type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showSource && (
            <button
              onClick={() => setShowCode(!showCode)}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              {showCode ? 'Hide Source' : 'Show Source'}
            </button>
          )}
          {zoomable && (
            <>
              <button
                onClick={handleZoomOut}
                className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-50"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                title="Reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-50"
                title="Zoom in"
              >
                +
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diagram */}
      <div className="flowdiagram-content relative bg-white">
        {error ? (
          <div className="p-4 text-red-600 text-sm">
            <div className="font-medium">Failed to render diagram</div>
            <div className="mt-1 text-xs">{error}</div>
          </div>
        ) : (
          <div
            className="overflow-auto p-4"
            style={{
              maxHeight: '500px',
            }}
          >
            <div
              ref={containerRef}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease',
              }}
            />
          </div>
        )}
      </div>

      {/* Source Code */}
      {showCode && (
        <div className="flowdiagram-source border-t">
          <div className="bg-gray-50 px-4 py-2 border-b text-xs font-medium text-gray-500">
            MERMAID SOURCE
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto max-h-48 bg-gray-900 text-gray-100">
            {diagram}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Sequence Diagram Component
 */
export function SequenceDiagram(props: Omit<FlowDiagramProps, 'type'>) {
  return <FlowDiagram {...props} type="sequence" />;
}

/**
 * State Diagram Component
 */
export function StateDiagram(props: Omit<FlowDiagramProps, 'type'>) {
  return <FlowDiagram {...props} type="state" />;
}

/**
 * ER Diagram Component
 */
export function ERDiagram(props: Omit<FlowDiagramProps, 'type'>) {
  return <FlowDiagram {...props} type="er" />;
}

export default FlowDiagram;
