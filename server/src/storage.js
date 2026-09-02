import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const localUploads = new Map();
const localUploadedTypes = new Map();

function config() {
  const provider = process.env.ASSET_STORAGE_PROVIDER;
  const bucket = process.env.ASSET_BUCKET;
  const publicBaseUrl = process.env.ASSET_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (provider === 'local') {
    if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('正式環境不得使用本機 Banner 儲存。'), { status: 503 });
    const directory = process.env.ASSET_LOCAL_DIRECTORY;
    const localBaseUrl = process.env.ASSET_LOCAL_BASE_URL?.replace(/\/$/, '');
    if (!directory || !localBaseUrl) throw Object.assign(new Error('本機 Banner 儲存尚未設定。'), { status: 503 });
    return { provider, directory, localBaseUrl };
  }
  if (!provider || !bucket || !publicBaseUrl) throw Object.assign(new Error('Banner 物件儲存尚未設定。'), { status: 503 });
  if (!['s3', 'gcs'].includes(provider)) throw Object.assign(new Error('不支援的 Banner 物件儲存供應商。'), { status: 503 });
  return { provider, bucket, publicBaseUrl };
}

function objectKey(fileName) {
  const extension = fileName.toLowerCase().match(/\.(?:jpe?g|png|webp)$/)?.[0] ?? '';
  const prefix = (process.env.ASSET_PREFIX ?? 'banners').replace(/^\/+|\/+$/g, '');
  return `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
}

export function validateBannerUpload(input) {
  if (!allowedTypes.has(input.contentType)) throw Object.assign(new Error('僅支援 PNG、JPG、WebP 圖片。'), { status: 400 });
  if (!Number.isInteger(input.contentLength) || input.contentLength < 1 || input.contentLength > MAX_SIZE) throw Object.assign(new Error('Banner 圖片大小必須介於 1 byte 至 5 MB。'), { status: 400 });
}

export async function createBannerUpload(input) {
  validateBannerUpload(input);
  const settings = config();
  const key = objectKey(input.fileName);
  if (settings.provider === 'local') {
    await mkdir(path.join(settings.directory, path.dirname(key)), { recursive: true });
    const token = crypto.randomUUID();
    localUploads.set(token, { key, contentType: input.contentType, contentLength: input.contentLength, expiresAt: Date.now() + 300000 });
    return { objectKey: key, publicUrl: `${settings.localBaseUrl}/api/v1/public/banner-assets/${key}`, uploadUrl: `${settings.localBaseUrl}/api/v1/internal/local-banner-uploads/${token}` };
  }
  if (settings.provider === 's3') {
    const client = new S3Client({ region: process.env.AWS_REGION });
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: settings.bucket, Key: key, ContentType: input.contentType }), { expiresIn: 300 });
    return { objectKey: key, publicUrl: `${settings.publicBaseUrl}/${key}`, uploadUrl };
  }
  const storage = new Storage();
  const [uploadUrl] = await storage.bucket(settings.bucket).file(key).getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 300000, contentType: input.contentType });
  return { objectKey: key, publicUrl: `${settings.publicBaseUrl}/${key}`, uploadUrl };
}

export async function writeLocalBannerUpload(token, body, contentType) {
  const upload = localUploads.get(token);
  if (!upload || upload.expiresAt < Date.now()) {
    localUploads.delete(token);
    throw Object.assign(new Error('本機 Banner 上傳網址已失效。'), { status: 404 });
  }
  if (contentType !== upload.contentType || body.length !== upload.contentLength) throw Object.assign(new Error('上傳素材的類型或大小與申請不符。'), { status: 409 });
  const settings = config();
  if (settings.provider !== 'local') throw Object.assign(new Error('本機上傳端點未啟用。'), { status: 404 });
  const destination = path.resolve(settings.directory, upload.key);
  if (!destination.startsWith(`${path.resolve(settings.directory)}${path.sep}`)) throw Object.assign(new Error('無效的本機素材路徑。'), { status: 400 });
  await writeFile(destination, body, { flag: 'wx' });
  localUploadedTypes.set(upload.key, contentType);
  localUploads.delete(token);
}

export async function inspectBannerUpload(objectKey) {
  const settings = config();
  if (settings.provider === 'local') {
    const destination = path.resolve(settings.directory, objectKey);
    if (!destination.startsWith(`${path.resolve(settings.directory)}${path.sep}`)) throw Object.assign(new Error('無效的本機素材路徑。'), { status: 400 });
    const info = await stat(destination);
    return { contentType: localUploadedTypes.get(objectKey), sizeBytes: info.size };
  }
  if (settings.provider === 's3') {
    const client = new S3Client({ region: process.env.AWS_REGION });
    const response = await client.send(new HeadObjectCommand({ Bucket: settings.bucket, Key: objectKey }));
    return { contentType: response.ContentType, sizeBytes: response.ContentLength };
  }
  const [metadata] = await new Storage().bucket(settings.bucket).file(objectKey).getMetadata();
  return { contentType: metadata.contentType, sizeBytes: Number(metadata.size) };
}
