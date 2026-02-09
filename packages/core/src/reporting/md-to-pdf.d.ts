/**
 * Type declarations for md-to-pdf (optional dependency)
 * This is a stub - md-to-pdf is loaded dynamically and may not be installed
 */
declare module 'md-to-pdf' {
  export interface MdToPdfOptions {
    dest?: string;
    css?: string;
    pdf_options?: {
      format?: string;
      margin?: { top?: string; bottom?: string; left?: string; right?: string };
      printBackground?: boolean;
      [key: string]: unknown;
    };
    launch_options?: {
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  export interface MdToPdfInput {
    content: string;
  }

  export function mdToPdf(
    input: MdToPdfInput,
    options?: MdToPdfOptions
  ): Promise<{ content: Buffer; filename: string }>;
}
