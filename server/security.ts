// Never serialize password material, including nested user objects.
export function publicJson(value:any):any {
  if(value == null || typeof value !== 'object' || value instanceof Date) return value;
  if(Array.isArray(value))return value.map(publicJson);
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['password','plainPassword','plain_password'].includes(key)).map(([key,v])=>[key,publicJson(v)]));
}
export function ownsTelegramContact(contactUserId:number|undefined,senderId:number|undefined,chatType:string|undefined) {
  return chatType === 'private' && senderId != null && contactUserId === senderId;
}
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

// v2 signs tokens with a server-only key. Legacy tokens exposed their own secret.
export function createSuperAdminAuth(tokenSecret: string, sessionSecret: string, now = Date.now) {
  const enabled = Boolean(tokenSecret && sessionSecret);
  const key = createHmac('sha256', sessionSecret).update(`super-admin-v2:${tokenSecret}`).digest();
  const sign = (payload: string) => createHmac('sha256', key).update(payload).digest('base64url');
  const generate = () => {
    if (!enabled) throw new Error('Super admin sozlanmagan');
    const payload = `v2.${now()}.${randomBytes(24).toString('base64url')}`;
    return `${payload}.${sign(payload)}`;
  };
  const verify = (token: string) => {
    if (!enabled || token.length > 256) return false;
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== 'v2' || !/^\d{13}$/.test(parts[1]) || !/^[\w-]{32}$/.test(parts[2])) return false;
    const age = now() - Number(parts[1]);
    if (age < 0 || age > 24 * 60 * 60 * 1000) return false;
    const expected = Buffer.from(sign(parts.slice(0, 3).join('.')));
    const actual = Buffer.from(parts[3]);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };
  const requireAuth: RequestHandler = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !verify(header.slice(7))) {
      res.status(401).json({ error: "Avtorizatsiya talab qilinadi. Qayta kiring." });
      return;
    }
    next();
  };
  return { generate, verify, requireAuth };
}
