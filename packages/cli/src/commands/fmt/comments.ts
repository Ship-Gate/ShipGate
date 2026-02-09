/**
 * Comment Extractor
 * 
 * Extracts comments from ISL source code for preservation during formatting.
 */

export interface Comment {
  text: string;
  line: number;
  column: number;
  type: 'line' | 'block' | 'hash';
}

/**
 * Extract all comments from ISL source code
 */
export class CommentExtractor {
  private source: string;
  private lines: string[];

  constructor(source: string) {
    this.source = source;
    this.lines = source.split('\n');
  }

  /**
   * Extract all comments from the source
   */
  extract(): Comment[] {
    const comments: Comment[] = [];
    let inBlockComment = false;
    let blockStartLine = 0;
    let blockStartCol = 0;
    let blockText: string[] = [];

    for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
      const line = this.lines[lineNum]!;
      let col = 0;

      while (col < line.length) {
        if (inBlockComment) {
          // Look for end of block comment
          const endIdx = line.indexOf('*/', col);
          if (endIdx !== -1) {
            blockText.push(line.substring(col, endIdx + 2));
            comments.push({
              text: blockText.join('\n'),
              line: blockStartLine,
              column: blockStartCol,
              type: 'block',
            });
            inBlockComment = false;
            blockText = [];
            col = endIdx + 2;
            continue;
          } else {
            blockText.push(line.substring(col));
            break; // Continue to next line
          }
        }

        // Check for block comment start
        if (line.substring(col).startsWith('/*')) {
          inBlockComment = true;
          blockStartLine = lineNum;
          blockStartCol = col;
          blockText = [line.substring(col)];
          col += 2;
          continue;
        }

        // Check for line comment (//)
        if (line.substring(col).startsWith('//')) {
          const commentText = line.substring(col);
          comments.push({
            text: commentText,
            line: lineNum,
            column: col,
            type: 'line',
          });
          break; // Rest of line is comment
        }

        // Check for hash comment (#)
        if (line.substring(col).startsWith('#')) {
          const commentText = line.substring(col);
          comments.push({
            text: commentText,
            line: lineNum,
            column: col,
            type: 'hash',
          });
          break; // Rest of line is comment
        }

        col++;
      }

      if (inBlockComment) {
        blockText.push('\n');
      }
    }

    return comments;
  }

  /**
   * Get comments that should be associated with a specific line
   */
  getCommentsForLine(line: number): Comment[] {
    return this.extract().filter(c => c.line === line);
  }

  /**
   * Get comments that appear before a specific line
   */
  getCommentsBeforeLine(line: number, maxDistance: number = 2): Comment[] {
    const allComments = this.extract();
    return allComments.filter(c => {
      const distance = line - c.line;
      return distance > 0 && distance <= maxDistance;
    });
  }
}
