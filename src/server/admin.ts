import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const TOKEN_TTL_MS = 12 * 60 * 60_000;

function secret(): string {
  return `${process.env.ADMIN_USERNAME || 'operator'}:${process.env.ADMIN_PASSWORD || ''}`;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Returns a signed token valid for 12 hours, or null for wrong credentials. */
export function adminLogin(username: unknown, password: unknown): string | null {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword || typeof username !== 'string' || typeof password !== 'string') return null;
  const okUser = safeEqual(username, process.env.ADMIN_USERNAME || 'operator');
  const okPass = safeEqual(password, expectedPassword);
  if (!okUser || !okPass) return null;
  const expires = String(Date.now() + TOKEN_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

function verify(token: string | undefined): boolean {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, sign(expires));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!verify(req.headers['x-admin-token'] as string | undefined)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
