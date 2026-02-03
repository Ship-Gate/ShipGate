/**
 * UI Blueprint Safety Checker
 * 
 * Gate checks for generated UI:
 * - Accessibility (a11y) basics
 * - Link validation (no unsafe redirects)
 * - No inline secrets
 * - SEO requirements
 * - Performance considerations
 */

import type * as AST from '@isl-lang/isl-core/ast/types';
import type { SafetyCheckResult, SafetyCheck } from './types.js';

/**
 * Patterns that indicate potential secrets
 */
const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /password/i,
  /bearer\s+[a-zA-Z0-9]/i,
  /sk[_-]live[_-]/i,
  /sk[_-]test[_-]/i,
  /pk[_-]live[_-]/i,
  /pk[_-]test[_-]/i,
  /ghp_[a-zA-Z0-9]/,
  /gho_[a-zA-Z0-9]/,
  /[a-f0-9]{32,}/i,
  /eyJ[a-zA-Z0-9]/,  // JWT tokens
  /AIza[a-zA-Z0-9]/,  // Google API keys
  /AKIA[A-Z0-9]/,  // AWS keys
];

/**
 * Unsafe URL patterns
 */
const UNSAFE_URL_PATTERNS = [
  /^javascript:/i,
  /^data:/i,
  /^file:/i,
  /^vbscript:/i,
];

/**
 * Run all safety checks on a UI blueprint
 */
export function checkBlueprintSafety(blueprint: AST.UIBlueprintDeclaration): SafetyCheckResult {
  const checks: SafetyCheck[] = [];

  // Run all check categories
  checks.push(...checkAccessibility(blueprint));
  checks.push(...checkSecurity(blueprint));
  checks.push(...checkSEO(blueprint));
  checks.push(...checkPerformance(blueprint));

  const passed = checks.every(c => c.passed || c.severity !== 'error');

  return { passed, checks };
}

/**
 * Accessibility checks
 */
function checkAccessibility(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Check all sections for a11y issues
  for (const section of blueprint.sections) {
    // Check images have alt text
    const imageChecks = checkImagesHaveAlt(section);
    checks.push(...imageChecks);

    // Check forms have labels
    const formChecks = checkFormsHaveLabels(section);
    checks.push(...formChecks);

    // Check buttons have accessible names
    const buttonChecks = checkButtonsHaveNames(section);
    checks.push(...buttonChecks);

    // Check heading hierarchy
    const headingChecks = checkHeadingHierarchy(section);
    checks.push(...headingChecks);
  }

  // Add overall a11y pass if no errors
  const hasA11yErrors = checks.some(c => c.category === 'a11y' && !c.passed);
  if (!hasA11yErrors) {
    checks.push({
      name: 'a11y_basic_compliance',
      category: 'a11y',
      passed: true,
      message: 'Basic accessibility checks passed',
      severity: 'info',
    });
  }

  return checks;
}

/**
 * Check that all images have alt text
 */
function checkImagesHaveAlt(section: AST.UISection): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  
  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'image') {
      const hasAlt = block.props.some(p => 
        p.name.name.toLowerCase() === 'alt' && 
        p.value.kind === 'StringLiteral' && 
        p.value.value.trim().length > 0
      );

      checks.push({
        name: `image_alt_${section.name.name}`,
        category: 'a11y',
        passed: hasAlt,
        message: hasAlt 
          ? `Image in ${section.name.name} has alt text`
          : `Image in ${section.name.name} is missing alt text`,
        severity: hasAlt ? 'info' : 'error',
      });
    }

    // Check children recursively
    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const block of section.blocks) {
    checkBlock(block);
  }

  return checks;
}

/**
 * Check that forms have proper labels
 */
function checkFormsHaveLabels(section: AST.UISection): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'form') {
      // Check each input-like child has a label
      const inputs = block.children?.filter(c => 
        c.type === 'text' && c.props.some(p => p.name.name === 'name')
      ) || [];

      for (const input of inputs) {
        const hasLabel = input.props.some(p => 
          p.name.name.toLowerCase() === 'label' &&
          p.value.kind === 'StringLiteral' &&
          p.value.value.trim().length > 0
        );

        const inputName = input.props.find(p => p.name.name === 'name');
        const name = inputName?.value.kind === 'StringLiteral' ? inputName.value.value : 'unknown';

        checks.push({
          name: `form_label_${name}`,
          category: 'a11y',
          passed: hasLabel,
          message: hasLabel
            ? `Form field "${name}" has label`
            : `Form field "${name}" is missing a label`,
          severity: hasLabel ? 'info' : 'warning',
        });
      }
    }

    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const block of section.blocks) {
    checkBlock(block);
  }

  return checks;
}

/**
 * Check buttons have accessible names
 */
function checkButtonsHaveNames(section: AST.UISection): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'button') {
      const hasName = block.props.some(p =>
        (p.name.name === 'label' || p.name.name === 'content') &&
        p.value.kind === 'StringLiteral' &&
        p.value.value.trim().length > 0
      );

      checks.push({
        name: `button_name_${section.name.name}`,
        category: 'a11y',
        passed: hasName,
        message: hasName
          ? 'Button has accessible name'
          : 'Button is missing accessible name (label or content)',
        severity: hasName ? 'info' : 'error',
      });
    }

    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const block of section.blocks) {
    checkBlock(block);
  }

  return checks;
}

/**
 * Check heading hierarchy
 */
function checkHeadingHierarchy(section: AST.UISection): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const headingLevels: number[] = [];

  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'heading') {
      const levelProp = block.props.find(p => p.name.name === 'level');
      const level = levelProp?.value.kind === 'NumberLiteral' 
        ? levelProp.value.value 
        : levelProp?.value.kind === 'StringLiteral' 
          ? parseInt(levelProp.value.value, 10) 
          : 1;
      headingLevels.push(level);
    }

    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const block of section.blocks) {
    checkBlock(block);
  }

  // Check for skipped levels
  let hasSkippedLevels = false;
  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1]!;
    const curr = headingLevels[i]!;
    if (curr > prev + 1) {
      hasSkippedLevels = true;
      break;
    }
  }

  if (headingLevels.length > 0) {
    checks.push({
      name: `heading_hierarchy_${section.name.name}`,
      category: 'a11y',
      passed: !hasSkippedLevels,
      message: hasSkippedLevels
        ? `Heading hierarchy skips levels in ${section.name.name}`
        : `Heading hierarchy is correct in ${section.name.name}`,
      severity: hasSkippedLevels ? 'warning' : 'info',
    });
  }

  return checks;
}

/**
 * Security checks
 */
function checkSecurity(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Check for inline secrets
  const secretChecks = checkNoInlineSecrets(blueprint);
  checks.push(...secretChecks);

  // Check for safe URLs
  const urlChecks = checkSafeUrls(blueprint);
  checks.push(...urlChecks);

  return checks;
}

/**
 * Check for hardcoded secrets in content
 */
function checkNoInlineSecrets(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const foundSecrets: string[] = [];

  function checkValue(value: AST.Expression, context: string) {
    if (value.kind === 'StringLiteral') {
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(value.value)) {
          foundSecrets.push(`Potential secret in ${context}: ${value.value.substring(0, 20)}...`);
        }
      }
    }
  }

  function checkBlock(block: AST.UIContentBlock, sectionName: string) {
    for (const prop of block.props) {
      checkValue(prop.value, `${sectionName}.${prop.name.name}`);
    }
    if (block.children) {
      for (const child of block.children) {
        checkBlock(child, sectionName);
      }
    }
  }

  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      checkBlock(block, section.name.name);
    }
  }

  // Check tokens too
  if (blueprint.tokens) {
    for (const token of blueprint.tokens.tokens) {
      checkValue(token.value, `tokens.${token.name.name}`);
    }
  }

  checks.push({
    name: 'no_inline_secrets',
    category: 'security',
    passed: foundSecrets.length === 0,
    message: foundSecrets.length === 0
      ? 'No inline secrets detected'
      : `Found ${foundSecrets.length} potential secret(s): ${foundSecrets.join(', ')}`,
    severity: foundSecrets.length === 0 ? 'info' : 'error',
  });

  return checks;
}

/**
 * Check all URLs are safe (no javascript:, data:, etc.)
 */
function checkSafeUrls(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];
  const unsafeUrls: string[] = [];

  function checkUrl(url: string, context: string) {
    for (const pattern of UNSAFE_URL_PATTERNS) {
      if (pattern.test(url)) {
        unsafeUrls.push(`${context}: ${url.substring(0, 30)}`);
      }
    }
  }

  function checkBlock(block: AST.UIContentBlock, sectionName: string) {
    // Check link and button hrefs
    if (block.type === 'link' || block.type === 'button') {
      const hrefProp = block.props.find(p => p.name.name === 'href');
      if (hrefProp?.value.kind === 'StringLiteral') {
        checkUrl(hrefProp.value.value, `${sectionName}.${block.type}`);
      }
    }

    // Check image src
    if (block.type === 'image') {
      const srcProp = block.props.find(p => p.name.name === 'src');
      if (srcProp?.value.kind === 'StringLiteral') {
        checkUrl(srcProp.value.value, `${sectionName}.image`);
      }
    }

    // Check form action
    if (block.type === 'form') {
      const actionProp = block.props.find(p => p.name.name === 'action');
      if (actionProp?.value.kind === 'StringLiteral') {
        checkUrl(actionProp.value.value, `${sectionName}.form.action`);
      }
    }

    if (block.children) {
      for (const child of block.children) {
        checkBlock(child, sectionName);
      }
    }
  }

  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      checkBlock(block, section.name.name);
    }
  }

  checks.push({
    name: 'safe_urls',
    category: 'security',
    passed: unsafeUrls.length === 0,
    message: unsafeUrls.length === 0
      ? 'All URLs are safe'
      : `Found ${unsafeUrls.length} unsafe URL(s): ${unsafeUrls.join(', ')}`,
    severity: unsafeUrls.length === 0 ? 'info' : 'error',
  });

  return checks;
}

/**
 * SEO checks
 */
function checkSEO(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Check for h1 heading
  let hasH1 = false;
  let h1Count = 0;

  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'heading') {
      const levelProp = block.props.find(p => p.name.name === 'level');
      const level = levelProp?.value.kind === 'NumberLiteral' 
        ? levelProp.value.value 
        : levelProp?.value.kind === 'StringLiteral'
          ? parseInt(levelProp.value.value, 10)
          : 1;
      if (level === 1) {
        hasH1 = true;
        h1Count++;
      }
    }
    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      checkBlock(block);
    }
  }

  checks.push({
    name: 'has_h1',
    category: 'seo',
    passed: hasH1,
    message: hasH1 ? 'Page has an h1 heading' : 'Page is missing an h1 heading',
    severity: hasH1 ? 'info' : 'warning',
  });

  checks.push({
    name: 'single_h1',
    category: 'seo',
    passed: h1Count <= 1,
    message: h1Count <= 1 
      ? 'Page has at most one h1 heading' 
      : `Page has ${h1Count} h1 headings (should have only one)`,
    severity: h1Count <= 1 ? 'info' : 'warning',
  });

  return checks;
}

/**
 * Performance checks
 */
function checkPerformance(blueprint: AST.UIBlueprintDeclaration): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  // Count total images
  let imageCount = 0;

  function checkBlock(block: AST.UIContentBlock) {
    if (block.type === 'image') {
      imageCount++;
    }
    if (block.children) {
      for (const child of block.children) {
        checkBlock(child);
      }
    }
  }

  for (const section of blueprint.sections) {
    for (const block of section.blocks) {
      checkBlock(block);
    }
  }

  // Warn if too many images
  checks.push({
    name: 'image_count',
    category: 'perf',
    passed: imageCount <= 10,
    message: imageCount <= 10
      ? `Page has ${imageCount} images (acceptable)`
      : `Page has ${imageCount} images (consider lazy loading)`,
    severity: imageCount <= 10 ? 'info' : 'warning',
  });

  // Check section count
  const sectionCount = blueprint.sections.length;
  checks.push({
    name: 'section_count',
    category: 'perf',
    passed: sectionCount <= 15,
    message: sectionCount <= 15
      ? `Page has ${sectionCount} sections`
      : `Page has ${sectionCount} sections (consider code splitting)`,
    severity: sectionCount <= 15 ? 'info' : 'warning',
  });

  return checks;
}

/**
 * Convert safety check result to gate-compatible format
 */
export function toGateFindings(result: SafetyCheckResult): Array<{
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
  line?: number;
}> {
  return result.checks
    .filter(c => !c.passed)
    .map(c => ({
      type: `ui_${c.category}_${c.name}`,
      severity: c.severity === 'error' ? 'high' as const : 'medium' as const,
      message: c.message,
    }));
}
