'use client';

import { ComplianceReport, ComplianceSummaryCard } from '@/components/ComplianceReport';

export default function CompliancePage() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 border-b flex items-center px-6 bg-background">
        <h1 className="text-xl font-semibold">Compliance</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <ComplianceReport />
        </div>
      </div>
    </div>
  );
}
