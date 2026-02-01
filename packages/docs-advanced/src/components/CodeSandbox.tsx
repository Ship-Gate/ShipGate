// ============================================================================
// CodeSandbox Component - Embedded code editor
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';

export interface CodeSandboxProps {
  /** Sandbox template */
  template: 'typescript' | 'javascript' | 'node' | 'react';
  
  /** Files in the sandbox */
  files: Record<string, string>;
  
  /** Entry file path */
  entryFile: string;
  
  /** Dependencies */
  dependencies?: Record<string, string>;
  
  /** Read-only mode */
  readOnly?: boolean;
  
  /** Auto-run on change */
  autoRun?: boolean;
  
  /** Height of the sandbox */
  height?: string;
  
  /** Theme */
  theme?: 'light' | 'dark';
}

export function CodeSandbox({
  template,
  files,
  entryFile,
  dependencies = {},
  readOnly = false,
  autoRun = false,
  height = '400px',
  theme = 'light',
}: CodeSandboxProps) {
  const [activeFile, setActiveFile] = useState(entryFile);
  const [fileContents, setFileContents] = useState(files);
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  // Generate CodeSandbox/StackBlitz URL
  const generateEmbedUrl = () => {
    const params = new URLSearchParams();
    params.set('embed', '1');
    params.set('file', entryFile);
    params.set('theme', theme);
    
    // In production, this would generate a proper embed URL
    return `https://codesandbox.io/embed/new?${params.toString()}`;
  };

  const handleFileChange = (content: string) => {
    if (readOnly) return;
    
    setFileContents((prev) => ({
      ...prev,
      [activeFile]: content,
    }));
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running...');

    try {
      // In a real implementation, this would execute the code
      // For demo purposes, we just simulate execution
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setOutput(`// Output from ${entryFile}\n// Code execution simulated`);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpenExternal = () => {
    // Open in CodeSandbox/StackBlitz
    const url = generateEmbedUrl();
    window.open(url, '_blank');
  };

  const fileList = Object.keys(fileContents).filter(
    (f) => !f.startsWith('.') && !f.includes('node_modules')
  );

  return (
    <div 
      className={`codesandbox-container border rounded-lg overflow-hidden ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}
      style={{ height }}
    >
      {/* Header */}
      <div className={`codesandbox-header flex justify-between items-center px-3 py-2 border-b ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Code Sandbox</span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}>
            {template}
          </span>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          )}
          <button
            onClick={handleOpenExternal}
            className={`px-3 py-1 text-sm rounded ${
              theme === 'dark' 
                ? 'bg-gray-700 hover:bg-gray-600' 
                : 'border hover:bg-gray-50'
            }`}
          >
            Open in CodeSandbox →
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="codesandbox-content flex" style={{ height: `calc(${height} - 45px)` }}>
        {/* File Tree */}
        <div className={`codesandbox-files w-48 border-r overflow-auto ${
          theme === 'dark' ? 'bg-gray-850 border-gray-700' : 'bg-gray-50'
        }`}>
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 mb-2 px-2">
              FILES
            </div>
            {fileList.map((file) => (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`w-full text-left px-2 py-1.5 text-sm rounded truncate ${
                  file === activeFile
                    ? theme === 'dark'
                      ? 'bg-gray-700'
                      : 'bg-blue-100 text-blue-700'
                    : theme === 'dark'
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                {getFileIcon(file)} {file}
              </button>
            ))}
          </div>
        </div>

        {/* Editor + Output */}
        <div className="flex-1 flex flex-col">
          {/* Editor */}
          <div className="flex-1 relative">
            <textarea
              value={fileContents[activeFile] ?? ''}
              onChange={(e) => handleFileChange(e.target.value)}
              readOnly={readOnly}
              className={`w-full h-full p-4 font-mono text-sm resize-none focus:outline-none ${
                theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white'
              }`}
              spellCheck={false}
            />
            {readOnly && (
              <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Read-only
              </div>
            )}
          </div>

          {/* Output */}
          {output && (
            <div className={`codesandbox-output h-32 border-t overflow-auto ${
              theme === 'dark' ? 'bg-gray-850 border-gray-700' : 'bg-gray-50'
            }`}>
              <div className="text-xs font-medium text-gray-500 p-2 border-b">
                OUTPUT
              </div>
              <pre className="p-2 text-xs font-mono whitespace-pre-wrap">
                {output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return '📘';
    case 'js':
    case 'jsx':
      return '📙';
    case 'json':
      return '📋';
    case 'md':
      return '📝';
    case 'css':
      return '🎨';
    default:
      return '📄';
  }
}

export default CodeSandbox;
