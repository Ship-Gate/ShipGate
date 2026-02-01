/**
 * Generate PNG icon from SVG for VS Code marketplace
 * 
 * Requirements: npm install sharp
 * Usage: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');

// SVG content for the ISL icon (128x128)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <!-- Background -->
  <rect x="4" y="4" width="120" height="120" rx="16" fill="#1E293B"/>
  
  <!-- Border -->
  <rect x="4" y="4" width="120" height="120" rx="16" stroke="#3B82F6" stroke-width="4"/>
  
  <!-- ISL stylized as specification lines -->
  <g stroke="#3B82F6" stroke-width="5" stroke-linecap="round">
    <!-- I - vertical line -->
    <line x1="32" y1="40" x2="32" y2="88"/>
    <circle cx="32" cy="32" r="4" fill="#3B82F6"/>
    
    <!-- S - curved -->
    <path d="M52 44 C72 36, 76 52, 56 60 C36 68, 40 84, 60 88" fill="none"/>
    
    <!-- L - angular -->
    <line x1="80" y1="40" x2="80" y2="88"/>
    <line x1="80" y1="88" x2="104" y2="88"/>
  </g>
  
  <!-- Checkmark indicator -->
  <circle cx="104" cy="36" r="12" fill="#10B981"/>
  <path d="M98 36 L102 40 L110 32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Spec lines decoration -->
  <g stroke="#64748B" stroke-width="3" stroke-linecap="round" opacity="0.5">
    <line x1="24" y1="104" x2="72" y2="104"/>
    <line x1="24" y1="114" x2="56" y2="114"/>
  </g>
</svg>`;

async function generateIcon() {
  const iconsDir = path.join(__dirname, '..', 'icons');
  const svgPath = path.join(iconsDir, 'isl-icon-temp.svg');
  const pngPath = path.join(iconsDir, 'isl-icon.png');

  // Write SVG file
  fs.writeFileSync(svgPath, svgContent);
  console.log('Created temporary SVG:', svgPath);

  try {
    // Try to use sharp for conversion
    const sharp = require('sharp');
    
    await sharp(svgPath)
      .resize(128, 128)
      .png()
      .toFile(pngPath);
    
    console.log('Created PNG icon:', pngPath);
    console.log('Icon size: 128x128 pixels');
    
    // Clean up temp SVG
    fs.unlinkSync(svgPath);
    
    // Remind to update package.json
    console.log('\nRemember to add to package.json:');
    console.log('  "icon": "icons/isl-icon.png"');
    
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('\nTo generate PNG, install sharp and run again:');
      console.log('  npm install sharp --save-dev');
      console.log('  node scripts/generate-icon.js');
      console.log('\nOr use an online SVG to PNG converter with this SVG file:');
      console.log('  ', svgPath);
    } else {
      throw err;
    }
  }
}

generateIcon().catch(console.error);
