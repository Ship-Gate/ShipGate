import { UnauthorizedError } from '@/lib/errors';
import jwt from 'jsonwebtoken';

export function verifyAuth(request: Request): string {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) throw new UnauthorizedError();

  const token = authHeader.split(' ')[1];
  if (!token) throw new UnauthorizedError();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    return (payload as { userId: string }).userId;
  } catch {
    throw new UnauthorizedError();
  }
}