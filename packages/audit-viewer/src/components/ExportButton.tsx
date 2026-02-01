'use client';

import { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditFilters, ExportFormat } from '@/lib/types';
import { exportAuditEvents } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';

interface ExportButtonProps {
  filters: AuditFilters;
}

export function ExportButton({ filters }: ExportButtonProps) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const blob = await exportAuditEvents({
        format,
        filters,
        includeDetails: true,
        includeProofBundles: false,
      });
      
      const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'pdf';
      const filename = `audit-log-export-${new Date().toISOString().split('T')[0]}.${extension}`;
      
      downloadBlob(blob, filename);
    } catch (error) {
      // Error handling would go here
    } finally {
      setLoading(false);
    }
  };

  const formatIcons: Record<ExportFormat, typeof FileJson> = {
    json: FileJson,
    csv: FileSpreadsheet,
    pdf: FileText,
  };

  const FormatIcon = formatIcons[format];

  return (
    <div className="flex items-center gap-2">
      <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
        <SelectTrigger className="w-28">
          <FormatIcon className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="json">
            <span className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              JSON
            </span>
          </SelectItem>
          <SelectItem value="csv">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </span>
          </SelectItem>
          <SelectItem value="pdf">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleExport} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Export
      </Button>
    </div>
  );
}
