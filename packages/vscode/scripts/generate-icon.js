/**
 * Generate PNG icons for VS Code marketplace
 *
 * Produces:
 *   icon.png    — 256x256, Shipgate logo, transparent background
 *   banner.png  — 460x120, dark theme marketplace banner
 *
 * Requirements: npm install sharp
 * Usage: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');

// ── 256x256 Shipgate Icon SVG ──────────────────────────────────────────────

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none">
  <!-- Background -->
  <rect x="8" y="8" width="240" height="240" rx="28" fill="#0f172a"/>

  <!-- Shield / Gate shape -->
  <path d="M128 52 L188 80 L188 140 C188 176 160 204 128 220 C96 204 68 176 68 140 L68 80 Z"
        stroke="#3b82f6" stroke-width="8" fill="none" stroke-linejoin="round"/>

  <!-- Checkmark inside shield -->
  <path d="M104 140 L120 156 L156 116"
        stroke="#10b981" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Spec lines decoration -->
  <g stroke="#64748b" stroke-width="4" stroke-linecap="round" opacity="0.4">
    <line x1="56" y1="208" x2="144" y2="208"/>
    <line x1="56" y1="220" x2="112" y2="220"/>
    <line x1="56" y1="232" x2="128" y2="232"/>
  </g>
</svg>`;

// ── 460x120 Banner SVG ─────────────────────────────────────────────────────

const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 120" fill="none">
  <!-- Background -->
  <rect width="460" height="120" fill="#0a0a0a"/>

  <!-- Mini shield icon -->
  <path d="M40 24 L64 34 L64 56 C64 70 54 80 40 86 C26 80 16 70 16 56 L16 34 Z"
        stroke="#3b82f6" stroke-width="3" fill="none" stroke-linejoin="round"/>
  <path d="M32 54 L38 60 L50 46"
        stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

  <!-- Title -->
  <text x="80" y="52" font-family="system-ui, -apple-system, sans-serif"
        font-size="28" font-weight="700" fill="#f8fafc">Shipgate ISL</text>

  <!-- Subtitle -->
  <text x="80" y="76" font-family="system-ui, -apple-system, sans-serif"
        font-size="14" fill="#94a3b8">Behavioral Verification for AI-Generated Code</text>

  <!-- Decorative spec lines (right side) -->
  <g stroke="#1e293b" stroke-width="2" stroke-linecap="round" opacity="0.6">
    <line x1="340" y1="30" x2="440" y2="30"/>
    <line x1="340" y1="42" x2="420" y2="42"/>
    <line x1="340" y1="54" x2="435" y2="54"/>
    <line x1="360" y1="66" x2="410" y2="66"/>
    <line x1="340" y1="78" x2="440" y2="78"/>
    <line x1="340" y1="90" x2="400" y2="90"/>
  </g>
</svg>`;

async function generateAssets() {
  const rootDir = path.join(__dirname, '..');
  const iconPng = path.join(rootDir, 'icon.png');
  const bannerPng = path.join(rootDir, 'banner.png');

  try {
    const sharp = require('sharp');

    // Generate icon (256x256)
    await sharp(Buffer.from(iconSvg))
      .resize(256, 256)
      .png()
      .toFile(iconPng);
    const iconStats = fs.statSync(iconPng);
    const iconKb = (iconStats.size / 1024).toFixed(1);
    process.stdout.write(`Created icon.png (256x256, ${iconKb} KB)\\n`);

    // Generate banner (460x120)
    await sharp(Buffer.from(bannerSvg))
      .resize(460, 120)
      .png()
      .toFile(bannerPng);
    const bannerStats = fs.statSync(bannerPng);
    const bannerKb = (bannerStats.size / 1024).toFixed(1);
    process.stdout.write(`Created banner.png (460x120, ${bannerKb} KB)\\n`);

    process.stdout.write('\\nMarketplace assets ready.\\n');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      // Fallback: write SVGs so user can convert manually
      const iconSvgPath = path.join(rootDir, 'icon.svg');
      const bannerSvgPath = path.join(rootDir, 'banner.svg');

      fs.writeFileSync(iconSvgPath, iconSvg);
      fs.writeFileSync(bannerSvgPath, bannerSvg);

      process.stdout.write('sharp not installed — wrote SVG files instead:\\n');
      process.stdout.write(`  ${iconSvgPath}\\n`);
      process.stdout.write(`  ${bannerSvgPath}\\n`);
      process.stdout.write('\\nTo generate PNGs, install sharp and run again:\\n');
      process.stdout.write('  npm install sharp --save-dev\\n');
      process.stdout.write('  node scripts/generate-icon.js\\n');
    } else {
      throw err;
    }
  }
}

generateAssets().catch((err) => {
  process.stderr.write(String(err) + '\\n');
  process.exit(1);
});
