import fs from 'fs';
import path from 'path';
import type { ProofBundle } from '../types';

export class BundleWriter {
  static write(bundle: ProofBundle, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2), 'utf-8');
  }

  static read(bundlePath: string): ProofBundle {
    const content = fs.readFileSync(bundlePath, 'utf-8');
    return JSON.parse(content) as ProofBundle;
  }
}
