const required = ['DATABASE_URL', 'PUBLIC_ORIGIN', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'ORDER_EXPIRY_TOKEN', 'ORDER_EXPIRY_ACTOR_ID', 'ASSET_STORAGE_PROVIDER', 'ASSET_BUCKET', 'ASSET_PUBLIC_BASE_URL'];
const missing = required.filter(name => !process.env[name]);
const errors = [];

if (process.env.NODE_ENV !== 'production') errors.push('NODE_ENV 必須為 production。');
if (process.env.AUTH_MODE !== 'oidc') errors.push('AUTH_MODE 必須為 oidc。');
if (missing.length) errors.push(`缺少必要設定：${missing.join(', ')}。`);

for (const name of ['PUBLIC_ORIGIN', 'OIDC_ISSUER', 'ASSET_PUBLIC_BASE_URL']) {
  const value = process.env[name];
  if (value && !value.split(',').every(item => item.trim().startsWith('https://'))) errors.push(`${name} 必須只使用 HTTPS 網址。`);
}

if (process.env.ASSET_STORAGE_PROVIDER && !['s3', 'gcs'].includes(process.env.ASSET_STORAGE_PROVIDER)) errors.push('ASSET_STORAGE_PROVIDER 必須為 s3 或 gcs。');
if (process.env.ORDER_EXPIRY_TOKEN === 'local-development-only') errors.push('ORDER_EXPIRY_TOKEN 不可使用本機展示值。');

if (errors.length) {
  console.error(`正式部署設定未通過：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('正式部署設定檢查通過。');
