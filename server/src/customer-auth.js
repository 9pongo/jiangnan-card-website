import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = Buffer.from(await scrypt(password, salt, 64));
  const target = Buffer.from(expected, 'base64url');
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export function createOpaqueToken() { return randomBytes(32).toString('base64url'); }
export function hashToken(value) { return createHash('sha256').update(value).digest('hex'); }
export function createVerificationCode() { return String(randomInt(0, 1_000_000)).padStart(6, '0'); }
export function normalizeTaiwanMobile(value) {
  const compact = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{8}$/.test(compact)) return `+886${compact.slice(1)}`;
  if (/^\+8869\d{8}$/.test(compact)) return compact;
  return null;
}
