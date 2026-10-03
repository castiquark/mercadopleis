import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const DELIVERABLES_BUCKET = 'deliverables';
export const DOWNLOAD_URL_TTL_SECONDS = 300;

export function getS3Config() {
  const endpoint = process.env.NEON_STORAGE_ENDPOINT_URL || process.env.STORAGE_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL_S3;
  const accessKeyId = process.env.NEON_STORAGE_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.NEON_STORAGE_SECRET_ACCESS_KEY || process.env.STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.NEON_STORAGE_REGION || process.env.STORAGE_REGION || process.env.AWS_REGION || 'us-east-1';
  return { endpoint, accessKeyId, secretAccessKey, region };
}

export function getS3Client(): S3Client | null {
  const { endpoint, accessKeyId, secretAccessKey, region } = getS3Config();
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
}

/** Object key for an uploaded deliverable. Always scoped under the uploader's user id. */
export function buildObjectKey(userId: string, filename: string, now: number = Date.now()): string {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').replace(/^[._-]+/, '').slice(-100) || 'file';
  return `orders/${userId}/${now}-${clean}`;
}

/** Internal reference stored in the database instead of a public URL. */
export const STORAGE_REF_PREFIX = 'storage:';

export function toStorageRef(key: string): string {
  return `${STORAGE_REF_PREFIX}${key}`;
}

const KEY_PATTERN = /^orders\/[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]{1,120}$/;

/** Returns the object key of a storage reference, or null if the value is not a well-formed reference. */
export function parseStorageRef(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(STORAGE_REF_PREFIX)) return null;
  const key = value.slice(STORAGE_REF_PREFIX.length);
  return KEY_PATTERN.test(key) && !key.includes('..') ? key : null;
}

/** True when the reference points inside the folder of one of the given user ids (the seller uploaded it). */
export function isStorageRefOwnedBy(value: unknown, userIds: string[]): boolean {
  const key = parseStorageRef(value);
  if (!key) return false;
  const owner = key.split('/')[1];
  return userIds.some((id) => id === owner);
}

/** Short-lived signed GET URL that forces a download instead of rendering the file in the browser. */
export async function createDownloadUrl(key: string, client: S3Client | null = getS3Client()): Promise<string> {
  if (!client) throw new Error('Object storage is not configured');
  const filename = key.split('/').pop()?.replace(/^\d+-/, '') || 'deliverable';
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: DELIVERABLES_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
  );
}
