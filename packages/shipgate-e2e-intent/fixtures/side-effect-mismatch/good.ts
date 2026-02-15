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
  return {
    id: crypto.randomUUID(),
    title: input.title,
    content: `Report: ${input.title}\n\n${input.data}`,
    generated_at: new Date().toISOString(),
  };
}
