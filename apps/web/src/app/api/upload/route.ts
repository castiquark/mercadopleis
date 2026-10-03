import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { getAuthUserFromRequest } from '@/lib/serverAuth';
import { enforceRateLimit } from '@/lib/rateLimit';
import { DELIVERABLES_BUCKET, buildObjectKey, getS3Client, toStorageRef } from '@/lib/storage';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/webm',
]);

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to upload order deliverables' },
        { status: 401 }
      );
    }

    const limited = await enforceRateLimit([{ name: 'upload', id: authUser.id, limit: 20, windowSeconds: 3600 }]);
    if (limited) return limited;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Payload Too Large: Maximum allowed file size is 25 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB)` },
        { status: 413 }
      );
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: `Unsupported Media Type: Format '${file.type}' is not supported` },
        { status: 415 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute cryptographic SHA-256 hash for smart contract verification
    const sha256Hash = '0x' + crypto.createHash('sha256').update(buffer).digest('hex');

    const s3 = getS3Client();
    if (!s3) {
      console.error('Object storage credentials are not configured; refusing the upload');
      return NextResponse.json({ error: 'File storage is temporarily unavailable' }, { status: 503 });
    }

    const objectKey = buildObjectKey(authUser.id, file.name);
    await s3.send(
      new PutObjectCommand({
        Bucket: DELIVERABLES_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    return NextResponse.json({
      success: true,
      // Private reference, not a public URL: files are downloaded through GET /api/orders/{id}/deliverable.
      url: toStorageRef(objectKey),
      key: objectKey,
      hash: sha256Hash,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
    });
  } catch (err: any) {
    console.error('Error uploading deliverable to Neon Object Storage:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al procesar la subida del entregable' },
      { status: 500 }
    );
  }
}
