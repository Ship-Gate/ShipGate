export interface BadgeSVGOptions {
  label: string;
  message: string;
  color: string;
}

const FONT_FAMILY = 'Verdana,Geneva,DejaVu Sans,sans-serif';
const FONT_SIZE = 11;
const CHAR_WIDTH = 6.8;
const PADDING = 8;
const HEIGHT = 20;
const LABEL_BG = '#555';

function textWidth(text: string): number {
  return Math.round(text.length * CHAR_WIDTH + PADDING * 2);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateBadgeSVG(opts: BadgeSVGOptions): string {
  const labelWidth = textWidth(opts.label);
  const messageWidth = textWidth(opts.message);
  const totalWidth = labelWidth + messageWidth;
  const labelX = labelWidth / 2;
  const messageX = labelWidth + messageWidth / 2;
  const textY = 14;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${HEIGHT}" role="img" aria-label="${escapeXml(opts.label)}: ${escapeXml(opts.message)}">
  <title>${escapeXml(opts.label)}: ${escapeXml(opts.message)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${HEIGHT}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${HEIGHT}" fill="${LABEL_BG}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${HEIGHT}" fill="${opts.color}"/>
    <rect width="${totalWidth}" height="${HEIGHT}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" text-rendering="geometricPrecision" font-size="${FONT_SIZE}">
    <text x="${labelX}" y="${textY + 1}" fill="#010101" fill-opacity=".3">${escapeXml(opts.label)}</text>
    <text x="${labelX}" y="${textY}">${escapeXml(opts.label)}</text>
    <text x="${messageX}" y="${textY + 1}" fill="#010101" fill-opacity=".3">${escapeXml(opts.message)}</text>
    <text x="${messageX}" y="${textY}">${escapeXml(opts.message)}</text>
  </g>
</svg>`;
}

export const BADGE_COLORS = {
  green: '#4c1',
  red: '#e05d44',
  gray: '#9f9f9f',
} as const;
