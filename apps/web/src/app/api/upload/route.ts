import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

function getS3Config() {
  const endpoint =
    process.env.NEON_STORAGE_ENDPOINT_URL ||
    process.env.STORAGE_ENDPOINT_URL ||
    process.env.AWS_ENDPOINT_URL_S3;

  const accessKeyId =
    process.env.NEON_STORAGE_ACCESS_KEY_ID ||
    process.env.STORAGE_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;

  const secretAccessKey =
    process.env.NEON_STORAGE_SECRET_ACCESS_KEY ||
    process.env.STORAGE_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;

  const region =
    process.env.NEON_STORAGE_REGION ||
    process.env.STORAGE_REGION ||
    process.env.AWS_REGION ||
    'us-east-1';

  return { endpoint, accessKeyId, secretAccessKey, region };
}

function getS3Client() {
  const { endpoint, accessKeyId, secretAccessKey, region } = getS3Config();

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute cryptographic SHA-256 hash for smart contract verification
    const sha256Hash = '0x' + crypto.createHash('sha256').update(buffer).digest('hex');

    const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `orders/${Date.now()}-${cleanFilename}`;
    const bucket = 'deliverables';

    const s3 = getS3Client();

    let fileUrl = '';

    if (s3) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        })
      );

      const { endpoint } = getS3Config();
      fileUrl = `${endpoint}/${bucket}/${objectKey}`;
    } else {
      console.warn('Neon S3 credentials not configured, returning local reference');
      fileUrl = `https://storage.mercadopleis.club/${objectKey}`;
    }

    return NextResponse.json({
      success: true,
      url: fileUrl,
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
