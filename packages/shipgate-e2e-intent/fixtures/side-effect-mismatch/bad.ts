// BAD: Writes to filesystem — violates spec invariant "no_side_effects" / "no_file_writes"

import { writeFileSync } from 'fs';

export interface Report {
  id: string;
  title: string;
  content: string;
  generated_at: string;
}

export function GenerateReport(input: { title: string; data: string }): Report {
  if (!input.data || input.data.length === 0) {
    throw new Error('EMPTY_DATA');
  }
  const content = `Report: ${input.title}\n\n${input.data}`;

  // Side effect: writes file — spec says no_file_writes
  writeFileSync(`/tmp/report-${Date.now()}.txt`, content);

  return {
    id: crypto.randomUUID(),
    title: input.title,
    content,
    generated_at: new Date().toISOString(),
  };
}
