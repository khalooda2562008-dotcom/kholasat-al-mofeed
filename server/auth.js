import crypto from 'node:crypto';
import { parse, serialize } from 'cookie';

const COOKIE_NAME = 'km_admin';
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || '';
const sign = (value) => crypto.createHmac('sha256', secret()).update(value).digest('hex');

export function createAdminCookie(res) {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${expires}.${sign(String(expires))}`;
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, value, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 8 * 60 * 60
  }));
}

export function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 }));
}

export function isAdminRequest(req) {
  if (!secret()) return false;
  const token = parse(req.headers.cookie || '')[COOKIE_NAME];
  if (!token) return false;
  const [expires, supplied] = token.split('.');
  if (!expires || !supplied || Number(expires) < Date.now()) return false;
  const expected = sign(expires);
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
