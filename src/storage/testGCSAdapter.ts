import { GCSStorageAdapter } from './GCSStorageAdapter';

async function testGCS() {
  const gcs = new GCSStorageAdapter({ bucket: 'ntm-snapshots' });

  // Write a file
  await gcs.write('test-folder/hello.txt', 'Hello world!');
  console.log('File written.');

  // Read a file
  const data = await gcs.read('test-folder/hello.txt');
  console.log('File read:', data.toString());

  // List files
  const files = await gcs.list('test-folder/');
  console.log('Files:', files);

  // Check if a file exists
  const exists = await gcs.exists('test-folder/hello.txt');
  console.log('Exists:', exists);

  // Get metadata
  const metadata = await gcs.getMetadata('test-folder/hello.txt');
  console.log('Metadata:', metadata);

  // Copy file
  await gcs.copy('test-folder/hello.txt', 'test-folder/hello-copy.txt');
  console.log('File copied.');

  // Delete files
  await gcs.delete('test-folder/hello.txt');
  await gcs.delete('test-folder/hello-copy.txt');
  console.log('Files deleted.');
}

testGCS().catch(console.error); 