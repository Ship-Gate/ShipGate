/**
 * ShipGate Commands — barrel export
 */

export { registerGenerateCommand } from './generate';
export { registerVerifyCommands, getDiagnosticCollection } from './verify';
export { registerCoverageCommand, getLastCoverageReport } from './coverage';
export type { CoverageReport, FileCoverage } from './coverage';
