import { S3StorageAdapter } from './S3StorageAdapter.js';
import { randomBytes } from 'crypto';

async function testS3() {
  // Ensure these environment variables are set in your .env.local or similar
  const bucketName = process.env.TEST_S3_BUCKET_NAME;
  const region = process.env.TEST_AWS_REGION;
  const accessKeyId = process.env.TEST_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.TEST_AWS_SECRET_ACCESS_KEY;

  if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
    console.error('Error: Missing one or more required S3 configuration environment variables.');
    console.error('Please set: TEST_S3_BUCKET_NAME, TEST_AWS_REGION, TEST_AWS_ACCESS_KEY_ID, TEST_AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }

  const s3 = new S3StorageAdapter({
    bucket: bucketName,
    region: region,
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    // endpoint and forcePathStyle can be added if you're using a non-AWS S3-compatible service
  });

  const testFileName = `test-s3-object-${randomBytes(8).toString('hex')}.txt`;
  const testFileContent = 'Hello from S3StorageAdapter test!';
  const testPath = `test-s3-adapter/${testFileName}`;

  const testFileName2 = `test-s3-object-2-${randomBytes(8).toString('hex')}.txt`;
  const testFileContent2 = 'Second test file content!';
  const testPath2 = `test-s3-adapter/${testFileName2}`;

  const testFileNameCopy = `test-s3-object-copy-${randomBytes(8).toString('hex')}.txt`;
  const testPathCopy = `test-s3-adapter/${testFileNameCopy}`;
  const customMetadata = { foo: 'bar', test: 'meta' };

  const listPrefix = 'test-s3-adapter/';

  try {
    console.log(`Testing S3StorageAdapter with bucket: ${bucketName}, region: ${region}`);
    console.log(`Using test file path: ${testPath}`);

    // 1. Check if file exists (should be false)
    console.log(`\nStep 1: Checking if "${testPath}" exists (should be false)...`);
    let exists = await s3.exists(testPath);
    console.log(`File exists: ${exists}`);
    if (exists) {
      console.warn('Warning: Test file unexpectedly exists. Attempting to delete before proceeding...');
      await s3.delete(testPath); // Attempt to clean up if needed (delete is stubbed, this will fail)
                                  // For a real cleanup, you might need to manually delete or implement delete first.
      console.log('Placeholder delete called. If this was a real delete, the file would be gone.');
    }

    // 2. Write the file (with metadata)
    console.log(`\nStep 2: Writing file "${testPath}" with custom metadata...`);
    await s3.write(testPath, testFileContent, customMetadata);
    console.log('File written successfully.');

    // 2b. Write a second file for list testing
    console.log(`\nStep 2b: Writing second file "${testPath2}"...`);
    await s3.write(testPath2, testFileContent2);
    console.log('Second file written successfully.');

    // 3. Read the file and verify content
    console.log(`\nStep 3: Reading file "${testPath}"...`);
    const fileBuffer = await s3.read(testPath);
    const contentRead = fileBuffer.toString();
    console.log(`File content read: "${contentRead}"`);
    if (contentRead !== testFileContent) {
      console.error(`Error: File content mismatch. Expected "${testFileContent}", got "${contentRead}"`);
      throw new Error('Test failed: File content mismatch.');
    }
    console.log('File content verified successfully.');

    // 3b. getMetadata for the first file
    console.log(`\nStep 3b: Getting metadata for "${testPath}"...`);
    const metadata = await s3.getMetadata(testPath);
    console.log('Metadata:', metadata);
    if (!metadata || metadata.foo !== customMetadata.foo || metadata.test !== customMetadata.test) {
      console.error(`Error: Metadata mismatch. Expected ${JSON.stringify(customMetadata)}, got ${JSON.stringify(metadata)}`);
      throw new Error('Test failed: Metadata mismatch.');
    }
    console.log('Metadata verified successfully.');

    // 4. List files with prefix
    console.log(`\nStep 4: Listing files with prefix "${listPrefix}"...`);
    let files = await s3.list(listPrefix);
    console.log('Files found:', files);
    if (!files.includes(testPath)) {
      console.error(`Error: List does not include first test file "${testPath}". Found: ${files.join(', ')}`);
      throw new Error('Test failed: List missing first file.');
    }
    if (!files.includes(testPath2)) {
      console.error(`Error: List does not include second test file "${testPath2}". Found: ${files.join(', ')}`);
      throw new Error('Test failed: List missing second file.');
    }
    console.log('List content verified successfully.');

    // 4b. Copy the first file to a new key
    console.log(`\nStep 4b: Copying "${testPath}" to "${testPathCopy}"...`);
    await s3.copy(testPath, testPathCopy);
    console.log('File copied successfully.');
    // Read and verify content of the copy
    const copyBuffer = await s3.read(testPathCopy);
    const copyContent = copyBuffer.toString();
    if (copyContent !== testFileContent) {
      console.error(`Error: Copied file content mismatch. Expected "${testFileContent}", got "${copyContent}"`);
      throw new Error('Test failed: Copied file content mismatch.');
    }
    // Check metadata of the copy
    const copyMetadata = await s3.getMetadata(testPathCopy);
    if (!copyMetadata || copyMetadata.foo !== customMetadata.foo || copyMetadata.test !== customMetadata.test) {
      console.error(`Error: Copied file metadata mismatch. Expected ${JSON.stringify(customMetadata)}, got ${JSON.stringify(copyMetadata)}`);
      throw new Error('Test failed: Copied file metadata mismatch.');
    }
    console.log('Copy content and metadata verified successfully.');

    // 5. Check if first file exists (should be true)
    console.log(`\nStep 5: Checking if "${testPath}" exists (should be true)...`);
    exists = await s3.exists(testPath);
    console.log(`File exists: ${exists}`);
    if (!exists) {
      console.error(`Error: First file was not found before delete attempt. Path: "${testPath}"`);
      throw new Error('Test failed: First file missing before delete.');
    }

    // 6. Delete the files
    console.log(`\nStep 6: Deleting file "${testPath}"...`);
    await s3.delete(testPath);
    console.log('First file deleted.');
    console.log(`Deleting second file "${testPath2}"...`);
    await s3.delete(testPath2);
    console.log('Second file deleted.');
    console.log(`Deleting copied file "${testPathCopy}"...`);
    await s3.delete(testPathCopy);
    console.log('Copied file deleted.');

    // 7. Verify files no longer exist
    console.log(`\nStep 7: Verifying "${testPath}" no longer exists...`);
    exists = await s3.exists(testPath);
    console.log(`File exists: ${exists}`);
    if (exists) {
      console.error(`Error: First test file "${testPath}" still exists after delete.`);
      throw new Error('Test failed: First file not deleted.');
    }
    console.log(`Verifying "${testPath2}" no longer exists...`);
    exists = await s3.exists(testPath2);
    console.log(`File exists: ${exists}`);
    if (exists) {
      console.error(`Error: Second test file "${testPath2}" still exists after delete.`);
      throw new Error('Test failed: Second file not deleted.');
    }
    console.log(`Verifying copied file "${testPathCopy}" no longer exists...`);
    exists = await s3.exists(testPathCopy);
    console.log(`File exists: ${exists}`);
    if (exists) {
      console.error(`Error: Copied test file "${testPathCopy}" still exists after delete.`);
      throw new Error('Test failed: Copied file not deleted.');
    }
    console.log('Files successfully verified as deleted.');

    console.log('\nS3StorageAdapter full (exists, write, read, list, delete) test completed successfully!');

    // Cleanup:
    // Files should be deleted by the test itself now.
    console.log(`\nTest files "${testPath}", "${testPath2}", and "${testPathCopy}" were deleted by the test.`);
    console.log('You may want to double-check your S3 bucket to ensure no orphaned test files remain from previous failed runs.');

  } catch (error) {
    console.error('\nError during S3StorageAdapter test:');
    console.error(error);
    console.log(`\nReminder: If the test failed, please manually delete the following from bucket "${bucketName}" if they were created:`);
    console.log(`  - "${testPath}"`);
    console.log(`  - "${testPath2}"`);
    console.log(`  - "${testPathCopy}"`);
    process.exit(1);
  }
}

testS3().catch(error => {
  // Catch unhandled promise rejections from testS3 itself, though the try/catch inside should handle most.
  console.error('Unhandled error in testS3:', error);
  process.exit(1);
}); 