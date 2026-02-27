import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const user = await prisma.user.findByEmail('test@example.com');
