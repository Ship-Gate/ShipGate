'use client';

import { useState } from 'react';
import { Check, X, AlertTriangle, FileText, Download, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplianceReport, useComplianceSummary } from '@/hooks/useAuditLog';
import type { ComplianceFramework, DateRange, ComplianceControl } from '@/lib/types';
import { cn, formatNumber, formatPercentage } from '@/lib/utils';
import { getDateRangeFromPreset, type DateRangePreset } from '@/lib/filters';

export function ComplianceReport() {
  const [framework, setFramework] = useState<ComplianceFramework>('SOC2');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('last30days'));
  
  const { data, loading, error } = useComplianceReport(framework, dateRange);

  const frameworks: ComplianceFramework[] = ['SOC2', 'GDPR', 'HIPAA', 'PCI-DSS', 'ISO27001'];

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Error loading compliance report: {error.message}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Compliance Report</h2>
        <div className="flex items-center gap-3">
          <Select value={framework} onValueChange={(v) => setFramework(v as ComplianceFramework)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frameworks.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value="last30days"
            onValueChange={(preset) => setDateRange(getDateRangeFromPreset(preset as DateRangePreset))}
          >
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Last 7 days</SelectItem>
              <SelectItem value="last30days">Last 30 days</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <ComplianceReportSkeleton />
      ) : data ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="Total Events"
              value={formatNumber(data.totalEvents)}
            />
            <StatCard
              label="Verified"
              value={formatNumber(data.verified)}
              percentage={data.verifiedPercentage}
              color="green"
            />
            <StatCard
              label="Violations"
              value={formatNumber(data.violations)}
              color={data.violations > 0 ? 'red' : 'green'}
            />
            <StatCard
              label="Compliance Score"
              value={`${data.complianceScore}%`}
              color={data.complianceScore >= 95 ? 'green' : data.complianceScore >= 80 ? 'yellow' : 'red'}
            />
          </div>

          {/* Controls Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Control Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {data.controls.map((control) => (
                  <ControlRow key={control.id} control={control} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export PDF Report
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  percentage?: number;
  color?: 'green' | 'yellow' | 'red';
}

function StatCard({ label, value, percentage, color }: StatCardProps) {
  const colorClasses = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn('text-2xl font-bold mt-1', color && colorClasses[color])}>
          {value}
        </div>
        {percentage !== undefined && (
          <div className="text-sm text-muted-foreground mt-1">
            {formatPercentage(percentage)} of total
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ControlRow({ control }: { control: ComplianceControl }) {
  const statusConfig = {
    compliant: {
      icon: Check,
      class: 'bg-green-100 text-green-800',
      iconClass: 'text-green-600',
    },
    'non-compliant': {
      icon: X,
      class: 'bg-red-100 text-red-800',
      iconClass: 'text-red-600',
    },
    'not-applicable': {
      icon: AlertTriangle,
      class: 'bg-gray-100 text-gray-800',
      iconClass: 'text-gray-600',
    },
    pending: {
      icon: AlertTriangle,
      class: 'bg-yellow-100 text-yellow-800',
      iconClass: 'text-yellow-600',
    },
  };

  const config = statusConfig[control.status];
  const Icon = config.icon;

  return (
    <div className="px-4 py-3 flex items-center justify-between hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', control.status === 'compliant' ? 'bg-green-100' : 'bg-red-100')}>
          <Icon className={cn('h-4 w-4', config.iconClass)} />
        </div>
        <div>
          <div className="font-medium">{control.id}</div>
          <div className="text-sm text-muted-foreground">{control.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {control.violations > 0 && (
          <span className="text-sm text-red-600">
            {control.violations} violation{control.violations > 1 ? 's' : ''}
          </span>
        )}
        <Badge className={config.class}>{control.status}</Badge>
      </div>
    </div>
  );
}

function ComplianceReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ComplianceSummaryCard() {
  const { summaries, loading } = useComplianceSummary();

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compliance Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {summaries.map((summary) => (
            <div key={summary.framework} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{summary.framework}</div>
                <div className="text-sm text-muted-foreground">
                  {summary.compliantControls}/{summary.totalControls} controls
                </div>
              </div>
              <div className="flex items-center gap-3">
                {summary.violations > 0 && (
                  <Badge variant="danger">{summary.violations} violations</Badge>
                )}
                <div
                  className={cn(
                    'text-xl font-bold',
                    summary.score >= 95 ? 'text-green-600' : summary.score >= 80 ? 'text-yellow-600' : 'text-red-600'
                  )}
                >
                  {Math.round(summary.score)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
