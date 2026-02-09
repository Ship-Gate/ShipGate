import { debounce } from 'lodash';
import express from 'express';

export function main() {
  const app = express();
  const debounced = debounce(() => {}, 100);
  return app;
}
