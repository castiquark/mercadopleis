import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { buildObjectKey, createDownloadUrl, isStorageRefOwnedBy, parseStorageRef, toStorageRef } from './storage';

const USER = '0b8a6c3e-6a36-4d3e-9b0a-2f6c1d9e7a11';
const OTHER = '11111111-2222-3333-4444-555555555555';

describe('storage references', () => {
  it('round-trips an object key through a storage reference', () => {
    const key = buildObjectKey(USER, 'informe final.pdf', 1790000000000);
    expect(key).toBe(`orders/${USER}/1790000000000-informe_final.pdf`);
    expect(parseStorageRef(toStorageRef(key))).toBe(key);
  });

  it('sanitises hostile file names', () => {
    const key = buildObjectKey(USER, '../../etc/passwd', 1);
    expect(key).not.toContain('..');
    expect(key.split('/')).toHaveLength(3);
    expect(parseStorageRef(toStorageRef(key))).toBe(key);
  });

  it.each([
    'https://example.com/file',
    'storage:',
    'storage:orders/not-a-uuid/file.txt',
    `storage:orders/${USER}/../x.txt`,
    `storage:orders/${USER}/a/b.txt`,
    `storage:other/${USER}/a.txt`,
    `storage:orders/${USER}/`,
    undefined,
    null,
    42,
  ])('rejects %s', (v) => {
    expect(parseStorageRef(v as unknown)).toBeNull();
  });

  it('only treats a reference as owned by the user whose folder it lives in', () => {
    const ref = toStorageRef(buildObjectKey(USER, 'a.txt'));
    expect(isStorageRefOwnedBy(ref, [USER])).toBe(true);
    expect(isStorageRefOwnedBy(ref, [OTHER])).toBe(false);
    expect(isStorageRefOwnedBy(ref, [OTHER, USER])).toBe(true);
    expect(isStorageRefOwnedBy('https://x.test/a', [USER])).toBe(false);
  });
});

describe('createDownloadUrl', () => {
  const client = new S3Client({
    endpoint: 'https://storage.example.test',
    region: 'us-east-1',
    credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' },
    forcePathStyle: true,
  });

  it('creates a short-lived signed URL that forces a download', async () => {
    const key = buildObjectKey(USER, 'informe.pdf', 1790000000000);
    const url = new URL(await createDownloadUrl(key, client));
    expect(url.origin).toBe('https://storage.example.test');
    expect(url.pathname).toBe(`/deliverables/${key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="informe.pdf"');
  });

  it('fails clearly when storage is not configured', async () => {
    await expect(createDownloadUrl(buildObjectKey(USER, 'a.txt'), null)).rejects.toThrow(/not configured/);
  });
});
