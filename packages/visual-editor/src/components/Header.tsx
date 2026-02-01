'use client';

import { Save, Download, Upload, Undo, Redo, Settings, FileCode } from 'lucide-react';
import { useEditorStore } from '@/hooks/useEditorStore';
import { useCodeSync } from '@/hooks/useCodeSync';

export function Header() {
  const { domainName, domainVersion, isDirty, setDomainInfo, resetEditor } = useEditorStore();
  const { islCode } = useCodeSync();

  const handleExport = () => {
    const blob = new Blob([islCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${domainName.toLowerCase()}.isl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNew = () => {
    if (isDirty && !confirm('You have unsaved changes. Create new specification?')) {
      return;
    }
    resetEditor();
  };

  return (
    <header className="h-14 bg-panel border-b border-accent flex items-center justify-between px-4">
      {/* Left - Logo & Domain Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-6 h-6 text-highlight" />
          <span className="font-bold text-lg">ISL Editor</span>
        </div>
        
        <div className="h-6 w-px bg-accent" />
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={domainName}
            onChange={(e) => setDomainInfo(e.target.value, domainVersion)}
            className="bg-accent/50 border border-accent rounded px-2 py-1 text-sm w-36 focus:outline-none focus:border-highlight"
            placeholder="Domain name"
          />
          <span className="text-gray-500">v</span>
          <input
            type="text"
            value={domainVersion}
            onChange={(e) => setDomainInfo(domainName, e.target.value)}
            className="bg-accent/50 border border-accent rounded px-2 py-1 text-sm w-20 focus:outline-none focus:border-highlight"
            placeholder="Version"
          />
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-highlight" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center - Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleNew}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="New"
        >
          <FileCode className="w-5 h-5" />
        </button>
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Undo"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Redo"
        >
          <Redo className="w-5 h-5" />
        </button>
        
        <div className="h-6 w-px bg-accent mx-2" />
        
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Import ISL"
        >
          <Upload className="w-5 h-5" />
        </button>
        <button
          onClick={handleExport}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Export ISL"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Save"
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      {/* Right - Settings */}
      <div className="flex items-center gap-2">
        <button
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
