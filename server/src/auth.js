import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks;
export async function verifyOidcAccessToken(authorization) {
  if (!authorization?.startsWith('Bearer ')) {
    throw Object.assign(new Error('需要 Bearer 存取權杖。'), { status: 401 });
  }
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  if (!issuer || !audience) {
    throw Object.assign(new Error('OIDC 尚未設定。'), { status: 503 });
  }
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, '')}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(authorization.slice(7), jwks, { issuer, audience });
  if (typeof payload.sub !== 'string' || !payload.sub) throw Object.assign(new Error('OIDC 權杖缺少 subject。'), { status: 401 });
  return payload.sub;
}
