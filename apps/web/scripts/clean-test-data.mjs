import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const bucket = 'deliverables';

async function main() {
  const isExecute = process.argv.includes('--execute');

  console.log('--------------------------------------------------');
  console.log('🧹 Mercadopleis - Test Data Inventory & Cleaner');
  console.log(`Bucket: ${bucket} (${region})`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Mode: ${isExecute ? 'EXECUTE (Deletion)' : 'DRY-RUN (Safe inspection only)'}`);
  console.log('--------------------------------------------------\n');

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.error('❌ Error: Missing S3 credentials in environment.');
    process.exit(1);
  }

  const s3 = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const listRes = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
  const objects = listRes.Contents || [];

  console.log(`📦 Neon Object Storage - Found ${objects.length} object(s):`);
  objects.forEach((obj, i) => {
    console.log(`  ${i + 1}. [${obj.Size} bytes] ${obj.Key} (Modified: ${obj.LastModified})`);
  });

  if (objects.length === 0) {
    console.log('  (Bucket is already completely empty)');
    return;
  }

  if (!isExecute) {
    console.log('\nℹ️ To actually delete these objects, run with: node --env-file=.env.local scripts/clean-test-data.mjs --execute');
    return;
  }

  console.log('\n⚠️ Proceeding with deletion...');
  const deleteParams = {
    Bucket: bucket,
    Delete: {
      Objects: objects.map((o) => ({ Key: o.Key })),
      Quiet: false,
    },
  };

  const delRes = await s3.send(new DeleteObjectsCommand(deleteParams));
  console.log(`✅ Successfully deleted ${delRes.Deleted?.length || 0} test object(s) from ${bucket}!`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
