import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import * as path from 'node:path';
import * as fs from 'fs';
import { helper } from './utils';

const app = express();
const prisma = new PrismaClient();

export { app, prisma };
