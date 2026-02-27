/**
 * Generate Command
 * 
 * Generates AI implementations from ISL specs.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL } from '@isl-lang/isl-core';
import { generateAllImplementations, type GenerationResult } from '@isl-lang/isl-ai';

export interface GenerateOptions {
  output?: string;
  model?: string;
  behavior?: string;
  apiKey?: string;
}

export interface GenerateResult {
  success: boolean;
  implementations: GenerationResult[];
  files: string[];
  errors: string[];
}

export async function generate(filePath: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const errors: string[] = [];
  const files: string[] = [];
  const implementations: GenerationResult[] = [];

  const spinner = ora('Parsing ISL spec...').start();

  try {
    // Read and parse
    const source = await readFile(filePath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(source, filePath);

    if (parseErrors.length > 0 || !ast) {
      spinner.fail('Failed to parse ISL spec');
      return {
        success: false,
        implementations: [],
        files: [],
        errors: parseErrors.map(e => 'message' in e ? e.message : String(e)),
      };
    }

    spinner.text = 'Generating implementations with AI...';

    // Generate implementations
    const results = await generateAllImplementations(ast, {
      apiKey: options.apiKey,
      model: options.model,
    });

    implementations.push(...results);

    // Determine output directory
    const outputDir = options.output ?? join(dirname(filePath), 'implementations');
    await mkdir(outputDir, { recursive: true });

    // Write implementations
    for (const impl of results) {
      const filename = `${impl.behaviorName.toLowerCase()}.impl.ts`;
      const implPath = join(outputDir, filename);
      
      // Add header comment
      const content = `/**
 * Auto-generated implementation for ${impl.behaviorName}
 * Model: ${impl.model}
 * Tokens used: ${impl.tokensUsed.input + impl.tokensUsed.output}
 * 
 * Generated from ISL spec. DO NOT EDIT directly.
 * Regenerate with: isl generate ${filePath}
 */

${impl.implementation}
`;
      
      await writeFile(implPath, content);
      files.push(implPath);
    }

    spinner.succeed('Implementation generation complete');

    return { success: true, implementations, files, errors };
  } catch (error) {
    spinner.fail('Generation failed');
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
    return { success: false, implementations, files, errors };
  }
}

export function printGenerateResult(result: GenerateResult): void {
  if (result.success) {
    console.log(chalk.green('✓') + ' Generation successful');
    console.log('');
    
    for (const impl of result.implementations) {
      console.log(chalk.cyan(`  ${impl.behaviorName}`));
      console.log(chalk.gray(`    Model: ${impl.model}`));
      console.log(chalk.gray(`    Tokens: ${impl.tokensUsed.input + impl.tokensUsed.output}`));
    }
    
    console.log('');
    console.log('Generated files:');
    for (const file of result.files) {
      console.log(chalk.gray(`  → ${file}`));
    }
  } else {
    console.log(chalk.red('✗') + ' Generation failed');
    for (const error of result.errors) {
      console.log(chalk.red(`  Error: ${error}`));
    }
  }
}
