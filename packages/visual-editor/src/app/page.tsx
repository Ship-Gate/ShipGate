'use client';

import { ReactFlowProvider } from 'reactflow';
import { Canvas } from '@/components/Canvas';
import { ToolPalette } from '@/components/ToolPalette';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { CodePreview } from '@/components/CodePreview';
import { Header } from '@/components/Header';

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-canvas">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Tool Palette */}
          <ToolPalette />
          
          {/* Main Canvas */}
          <div className="flex-1 relative">
            <Canvas />
          </div>
          
          {/* Right Sidebar - Properties & Code */}
          <div className="w-96 flex flex-col border-l border-accent bg-panel">
            <PropertiesPanel />
            <CodePreview />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
