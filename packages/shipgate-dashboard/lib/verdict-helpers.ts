import type { Severity } from './types';

const COLORS = {
  ship: '#00e68a',
  warn: '#ffb547',
  noship: '#ff5c6a',
  blue: '#38bdf8',
  text3: '#555566',
  highSev: '#ff8a4c',
};

const BG_COLORS = {
  ship: 'rgba(0,230,138,0.08)',
  warn: 'rgba(255,181,71,0.08)',
  noship: 'rgba(255,92,106,0.08)',
  blue: 'rgba(56,189,248,0.08)',
  text3: 'rgba(85,85,102,0.08)',
};

export function verdictColor(v: string): string {
  if (['SHIP', 'pass', 'success'].includes(v)) return COLORS.ship;
  if (['WARN', 'partial', 'pending'].includes(v)) return COLORS.warn;
  if (['NO_SHIP', 'fail', 'failure'].includes(v)) return COLORS.noship;
  if (['running', 'scanning'].includes(v)) return COLORS.blue;
  return COLORS.noship;
}

export function verdictBg(v: string): string {
  if (['SHIP', 'pass', 'success'].includes(v)) return BG_COLORS.ship;
  if (['WARN', 'partial', 'pending'].includes(v)) return BG_COLORS.warn;
  if (['NO_SHIP', 'fail', 'failure'].includes(v)) return BG_COLORS.noship;
  if (['running', 'scanning'].includes(v)) return BG_COLORS.blue;
  return BG_COLORS.noship;
}

export function severityColor(s: Severity): string {
  if (s === 'critical') return COLORS.noship;
  if (s === 'high') return COLORS.highSev;
  if (s === 'medium') return COLORS.warn;
  return COLORS.text3;
}
