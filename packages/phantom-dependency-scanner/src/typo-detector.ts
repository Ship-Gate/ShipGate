// ============================================================================
// Typo Detection and Fix Suggestions
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1, // deletion
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j - 1]! + 1 // substitution
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Find typo candidates from a list of package names
 */
export function findTypoCandidates(
  target: string,
  candidates: string[],
  maxResults = 5,
  minSimilarity = 0.6
): string[] {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: similarity(target.toLowerCase(), candidate.toLowerCase()),
    }))
    .filter((item) => item.score >= minSimilarity)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.candidate);

  return scored;
}

/**
 * Common package name patterns for better typo detection
 */
export function generateTypoCandidates(target: string): string[] {
  const candidates: string[] = [];

  // Common typos
  const commonTypos: Record<string, string[]> = {
    lodash: ['loadash', 'lodahs', 'lodash'],
    express: ['exress', 'exprss', 'express'],
    react: ['reac', 'reacct', 'react'],
    typescript: ['typescrip', 'typescripr', 'typescript'],
  };

  if (commonTypos[target]) {
    candidates.push(...commonTypos[target]!);
  }

  // Character transpositions (swap adjacent characters)
  for (let i = 0; i < target.length - 1; i++) {
    const arr = target.split('');
    [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
    candidates.push(arr.join(''));
  }

  // Missing character
  for (let i = 0; i < target.length; i++) {
    candidates.push(target.slice(0, i) + target.slice(i + 1));
  }

  // Extra character
  for (let i = 0; i <= target.length; i++) {
    for (const char of 'abcdefghijklmnopqrstuvwxyz') {
      candidates.push(target.slice(0, i) + char + target.slice(i));
    }
  }

  return candidates;
}
