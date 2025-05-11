import { R2StorageAdapter } from './R2StorageAdapter';

(async () => {
  if (!process.env.R2_BUCKET || 
      !process.env.R2_ENDPOINT || 
      !process.env.R2_ACCESS_KEY_ID || 
      !process.env.R2_SECRET_ACCESS_KEY) {
    console.error('Missing R2 environment variables (R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)');
    process.exit(1);
  }

  const r2 = new R2StorageAdapter({
    bucket: process.env.R2_BUCKET!,
    endpoint: process.env.R2_ENDPOINT!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    region: process.env.R2_REGION || 'auto', // Optional: R2_REGION, defaults to 'auto'
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE ? process.env.R2_FORCE_PATH_STYLE === 'true' : undefined,
  });

  const testFilePath = 'hello_r2.txt';
  const testFileContent = 'R2 says hi 👋';

  try {
    console.log(`Attempting to write ${testFilePath} to bucket ${process.env.R2_BUCKET}...`);
    await r2.write(testFilePath, testFileContent);
    console.log('Write successful.');

    console.log(`Checking existence of ${testFilePath}...`);
    const exists = await r2.exists(testFilePath);
    console.log('Exists?', exists);
    if (!exists) throw new Error('File not found after write');

    console.log(`Reading contents of ${testFilePath}...`);
    const contents = (await r2.read(testFilePath)).toString();
    console.log('Contents:', contents);
    if (contents !== testFileContent) throw new Error('File content mismatch');

    console.log("Listing R2 files");
    const list = await r2.list('');
    console.log('List:', list);
    if (!list.includes(testFilePath)) throw new Error('File not found in list');

    console.log(`Deleting ${testFilePath}...`);
    await r2.delete(testFilePath);
    console.log('Delete successful.');

    console.log(`Checking existence of ${testFilePath} after delete...`);
    const existsAfterDelete = await r2.exists(testFilePath);
    console.log('Exists after delete?', existsAfterDelete);
    if (existsAfterDelete) throw new Error('File still exists after delete');

    console.log('\n✅ R2 Adapter smoke test passed!');

  } catch (error) {
    console.error('\n❌ R2 Adapter smoke test failed:', error);
    process.exit(1);
  }
})(); 