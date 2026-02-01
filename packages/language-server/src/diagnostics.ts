/**
 * ISL Diagnostics
 */

import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLAnalyzer, ParseError } from './analyzer';
import { ISLSettings } from './server';

/**
 * Get diagnostics for document
 */
export function getDiagnostics(
  document: TextDocument,
  analyzer: ISLAnalyzer,
  settings: ISLSettings
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();
  const lines = text.split('\n');

  // Parse and analyze document
  const parsed = analyzer.analyzeDocument(document);

  // Add parse errors
  for (const error of parsed.errors.slice(0, settings.maxNumberOfProblems)) {
    diagnostics.push({
      severity: getSeverity(error.severity),
      range: error.range,
      message: error.message,
      source: 'isl',
    });
  }

  // Additional lint checks
  if (settings.enableSemanticAnalysis) {
    diagnostics.push(...runLintChecks(document, analyzer, settings));
  }

  return diagnostics;
}

function getSeverity(severity: ParseError['severity']): DiagnosticSeverity {
  switch (severity) {
    case 'error':
      return DiagnosticSeverity.Error;
    case 'warning':
      return DiagnosticSeverity.Warning;
    case 'info':
      return DiagnosticSeverity.Information;
    case 'hint':
      return DiagnosticSeverity.Hint;
    default:
      return DiagnosticSeverity.Error;
  }
}

function runLintChecks(
  document: TextDocument,
  analyzer: ISLAnalyzer,
  settings: ISLSettings
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for TODO comments
    const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK):/i);
    if (todoMatch) {
      diagnostics.push({
        severity: DiagnosticSeverity.Information,
        range: {
          start: { line: i, character: line.indexOf(todoMatch[0]) },
          end: { line: i, character: line.length },
        },
        message: `${todoMatch[1]} comment found`,
        source: 'isl',
      });
    }

    // Check for missing descriptions in behaviors
    if (line.trim().startsWith('behavior ') && !line.includes('description')) {
      // Look ahead for description
      let hasDescription = false;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes('description:')) {
          hasDescription = true;
          break;
        }
        if (lines[j].includes('input') || lines[j].includes('output')) {
          break;
        }
      }

      if (!hasDescription) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          message: 'Behavior should have a description',
          source: 'isl',
        });
      }
    }

    // Check for password/secret types without proper annotations
    if (line.includes('password') || line.includes('secret')) {
      if (!line.includes('[secret]') && !line.includes('[never_log]')) {
        const match = line.match(/(password|secret)/i);
        if (match) {
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: i, character: line.indexOf(match[0]) },
              end: { line: i, character: line.indexOf(match[0]) + match[0].length },
            },
            message: 'Sensitive field should have [secret] or [never_log] annotation',
            source: 'isl',
          });
        }
      }
    }

    // Check for email/phone types without PII annotation
    if ((line.includes('email') || line.includes('phone')) && line.includes(':')) {
      if (!line.includes('[pii]')) {
        diagnostics.push({
          severity: DiagnosticSeverity.Hint,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length },
          },
          message: 'Consider adding [pii] annotation for personal data',
          source: 'isl',
        });
      }
    }

    // Check for very long lines
    if (line.length > 120) {
      diagnostics.push({
        severity: DiagnosticSeverity.Hint,
        range: {
          start: { line: i, character: 120 },
          end: { line: i, character: line.length },
        },
        message: 'Line is longer than 120 characters',
        source: 'isl',
      });
    }

    // Check for trailing whitespace
    if (line.endsWith(' ') || line.endsWith('\t')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Hint,
        range: {
          start: { line: i, character: line.trimEnd().length },
          end: { line: i, character: line.length },
        },
        message: 'Trailing whitespace',
        source: 'isl',
      });
    }

    // Check for missing temporal constraints in behaviors with network calls
    if (line.includes('fetch') || line.includes('http') || line.includes('api')) {
      // This is a simplified check
      diagnostics.push({
        severity: DiagnosticSeverity.Hint,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length },
        },
        message: 'Consider adding temporal constraints for network operations',
        source: 'isl',
      });
    }
  }

  return diagnostics;
}
