import { S3StorageAdapter } from './S3StorageAdapter';

(async () => {
  const a = new S3StorageAdapter({
    bucket: process.env.S3_BUCKET!,
    region: process.env.AWS_REGION,
    endpoint: process.env.S3_ENDPOINT,   // leave undefined for AWS
    forcePathStyle: !!process.env.S3_ENDPOINT
  });

  await a.write('hello.txt', 'S3 says hi 👋');
  console.log('exists?', await a.exists('hello.txt'));
  console.log('contents:', (await a.read('hello.txt')).toString());
  console.log('list:', await a.list(''));
  await a.delete('hello.txt');
})(); 