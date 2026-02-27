import fs from 'fs';
import path from 'path';
import type { Config } from '../types';

export class ConfigLoader {
  static load(configPath?: string): Config {
    const searchPaths = configPath
      ? [configPath]
      : [
          '.isl-verify.json',
          '.isl-verify.js',
          'isl-verify.config.json',
          'isl-verify.config.js',
        ];

    for (const searchPath of searchPaths) {
      const absolutePath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(process.cwd(), searchPath);

      if (fs.existsSync(absolutePath)) {
        if (searchPath.endsWith('.json')) {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          return JSON.parse(content) as Config;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require(absolutePath) as Config;
        }
      }
    }

    return {};
  }
}
