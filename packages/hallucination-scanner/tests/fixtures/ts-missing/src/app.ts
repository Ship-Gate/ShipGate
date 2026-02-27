import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { Config } from '@types/config';
import { nonExistent } from './does-not-exist';

const app = express();
export { app };
