/**
 * @isl-lang/evidence-schema-html
 *
 * HTML renderer for ISL verification evidence reports.
 * Generates clean, readable, embeddable HTML from evidence reports.
 *
 * @example
 * ```typescript
 * import { render } from '@isl-lang/evidence-schema-html';
 * import type { EvidenceReport } from '@isl-lang/evidence-schema';
 *
 * // Render a full HTML document
 * const html = render(report, { fullDocument: true });
 *
 * // Render an embeddable fragment
 * const fragment = render(report, { includeStyles: true });
 *
 * // Save to file
 * fs.writeFileSync('report.html', html);
 * ```
 */

export {
  render,
  renderClausesOnly,
  renderBannerOnly,
  type RenderOptions,
} from './renderer.js';

export { defaultStyles, minimalStyles, getStyles } from './styles.js';
