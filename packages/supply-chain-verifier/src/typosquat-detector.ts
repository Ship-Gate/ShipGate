export interface TyposquatFinding {
  package: string;
  similarTo: string;
  distance: number;
  risk: 'high' | 'medium' | 'low';
}

/**
 * Levenshtein distance between two strings.
 * Uses the Wagner-Fischer algorithm with O(min(m,n)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;
  let prev = new Array<number>(aLen + 1);
  let curr = new Array<number>(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i]! + 1,        // deletion
        curr[i - 1]! + 1,    // insertion
        prev[i - 1]! + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen]!;
}

const POPULAR_PACKAGES: readonly string[] = [
  'react', 'react-dom', 'react-router', 'react-router-dom', 'react-redux',
  'react-hook-form', 'react-query', 'react-scripts', 'react-transition-group',
  'next', 'nuxt', 'vue', 'vue-router', 'vuex',
  'angular', '@angular/core', '@angular/cli',
  'svelte', 'solid-js', 'preact',
  'express', 'koa', 'fastify', 'hapi', 'restify', 'nest', '@nestjs/core',
  'lodash', 'lodash-es', 'underscore', 'ramda',
  'axios', 'got', 'node-fetch', 'superagent', 'request',
  'moment', 'dayjs', 'date-fns', 'luxon',
  'chalk', 'colors', 'picocolors', 'kleur',
  'commander', 'yargs', 'meow', 'inquirer', 'prompts',
  'webpack', 'rollup', 'vite', 'esbuild', 'parcel', 'turbo', 'tsup',
  'babel-core', '@babel/core', '@babel/preset-env', '@babel/preset-react',
  'typescript', 'ts-node', 'tsx',
  'jest', 'mocha', 'vitest', 'ava', 'tap', 'jasmine',
  'eslint', 'prettier', 'stylelint', 'biome',
  'tailwindcss', 'postcss', 'autoprefixer', 'sass', 'less',
  'styled-components', 'emotion', '@emotion/react', '@emotion/styled',
  'mongoose', 'sequelize', 'typeorm', 'prisma', '@prisma/client', 'knex', 'drizzle-orm',
  'pg', 'mysql2', 'sqlite3', 'redis', 'ioredis', 'mongodb',
  'jsonwebtoken', 'bcrypt', 'bcryptjs', 'passport', 'helmet',
  'cors', 'cookie-parser', 'body-parser', 'multer', 'morgan',
  'dotenv', 'cross-env', 'env-cmd',
  'uuid', 'nanoid', 'cuid',
  'fs-extra', 'glob', 'globby', 'fast-glob', 'chokidar',
  'debug', 'winston', 'pino', 'bunyan', 'log4js',
  'socket.io', 'ws', 'socket.io-client',
  'cheerio', 'puppeteer', 'playwright',
  'sharp', 'jimp', 'canvas',
  'nodemailer', 'sendgrid', '@sendgrid/mail',
  'stripe', 'paypal-rest-sdk',
  'aws-sdk', '@aws-sdk/client-s3', 'firebase', 'firebase-admin',
  'graphql', 'apollo-server', '@apollo/client', 'urql',
  'zod', 'yup', 'joi', 'ajv', 'superstruct', 'io-ts',
  'rxjs', 'immer', 'zustand', 'mobx', 'recoil', 'jotai', 'valtio',
  'clsx', 'classnames',
  'path-to-regexp', 'qs', 'query-string',
  'semver', 'minimatch', 'micromatch',
  'execa', 'shelljs', 'cross-spawn',
  'rimraf', 'mkdirp', 'make-dir',
  'ora', 'listr', 'cli-progress', 'progress',
  'tar', 'archiver', 'decompress', 'adm-zip',
  'http-proxy', 'http-proxy-middleware',
  'formidable', 'busboy',
  'lru-cache', 'node-cache', 'keyv',
  'p-limit', 'p-queue', 'p-map', 'p-retry',
  'retry', 'async-retry',
  'yaml', 'toml', 'ini', 'properties',
  'marked', 'markdown-it', 'remark', 'rehype',
  'highlight.js', 'prismjs', 'shiki',
  'three', 'd3', 'chart.js', 'recharts',
  'framer-motion', 'gsap', 'animejs',
  'swiper', 'embla-carousel',
  'i18next', 'react-i18next', 'intl-messageformat',
  '@types/node', '@types/react', '@types/express',
  'turbo', 'lerna', 'nx',
  'husky', 'lint-staged', 'commitlint',
  'storybook', '@storybook/react',
  'cypress', '@testing-library/react', '@testing-library/jest-dom',
  'msw', 'nock', 'sinon',
  'contentful', 'sanity', '@sanity/client',
  'next-auth', '@auth/core', 'lucia',
  'trpc', '@trpc/server', '@trpc/client',
  'swr', '@tanstack/react-query',
  'radix-ui', '@radix-ui/react-dialog', 'shadcn',
  'headlessui', '@headlessui/react',
] as const;

const KNOWN_TYPOSQUAT_PATTERNS: ReadonlyArray<[string, string]> = [
  ['1odash', 'lodash'],
  ['l0dash', 'lodash'],
  ['lodahs', 'lodash'],
  ['lodasg', 'lodash'],
  ['reacr', 'react'],
  ['recat', 'react'],
  ['reactt', 'react'],
  ['reavt', 'react'],
  ['raect', 'react'],
  ['exprss', 'express'],
  ['expres', 'express'],
  ['expresss', 'express'],
  ['axois', 'axios'],
  ['axio', 'axios'],
  ['axos', 'axios'],
  ['momment', 'moment'],
  ['monent', 'moment'],
  ['chlak', 'chalk'],
  ['chalks', 'chalk'],
  ['webpak', 'webpack'],
  ['webpackk', 'webpack'],
  ['typscript', 'typescript'],
  ['typescrip', 'typescript'],
  ['typecript', 'typescript'],
  ['eslintt', 'eslint'],
  ['eslnt', 'eslint'],
  ['pretiier', 'prettier'],
  ['pretter', 'prettier'],
  ['jestt', 'jest'],
  ['jset', 'jest'],
  ['moongose', 'mongoose'],
  ['mongose', 'mongoose'],
  ['seqeulize', 'sequelize'],
  ['sequilize', 'sequelize'],
  ['jsonwebtokn', 'jsonwebtoken'],
  ['bcryptt', 'bcrypt'],
  ['helment', 'helmet'],
  ['hemet', 'helmet'],
  ['stripee', 'stripe'],
  ['strpe', 'stripe'],
  ['zood', 'zod'],
  ['prismaa', 'prisma'],
  ['nex', 'next'],
  ['nextt', 'next'],
  ['vitest-', 'vitest'],
];

/**
 * Check a list of package names for potential typosquatting.
 * Returns findings sorted by risk level (high first).
 */
export function checkForTyposquatting(packages: string[]): TyposquatFinding[] {
  const findings: TyposquatFinding[] = [];
  const popularSet = new Set(POPULAR_PACKAGES);

  for (const pkg of packages) {
    if (popularSet.has(pkg)) continue;

    const knownPattern = KNOWN_TYPOSQUAT_PATTERNS.find(([typo]) => typo === pkg);
    if (knownPattern) {
      findings.push({
        package: pkg,
        similarTo: knownPattern[1],
        distance: levenshteinDistance(pkg, knownPattern[1]),
        risk: 'high',
      });
      continue;
    }

    let bestMatch: TyposquatFinding | null = null;

    for (const popular of POPULAR_PACKAGES) {
      if (popular.startsWith('@')) continue;

      const dist = levenshteinDistance(pkg, popular);

      if (dist === 0) continue;

      const maxLen = Math.max(pkg.length, popular.length);
      const similarity = 1 - dist / maxLen;

      if (dist === 1 && similarity >= 0.75) {
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { package: pkg, similarTo: popular, distance: dist, risk: 'high' };
        }
      } else if (dist === 2 && similarity >= 0.7 && maxLen >= 5) {
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { package: pkg, similarTo: popular, distance: dist, risk: 'medium' };
        }
      } else if (dist === 3 && similarity >= 0.75 && maxLen >= 8) {
        if (!bestMatch || dist < bestMatch.distance) {
          bestMatch = { package: pkg, similarTo: popular, distance: dist, risk: 'low' };
        }
      }
    }

    if (bestMatch) {
      findings.push(bestMatch);
    }
  }

  const riskOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => riskOrder[a.risk]! - riskOrder[b.risk]!);

  return findings;
}
