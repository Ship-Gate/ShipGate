import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    string: 'src/string.ts',
    math: 'src/math.ts',
    collections: 'src/collections.ts',
    json: 'src/json.ts',
    datetime: 'src/datetime.ts',
    uuid: 'src/uuid.ts',
    crypto: 'src/crypto.ts',
    encoding: 'src/encoding.ts',
    regex: 'src/regex.ts',
    url: 'src/url.ts',
  },
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
});
