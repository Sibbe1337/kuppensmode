import { R2StorageAdapter } from './R2StorageAdapter.js';
import { randomBytes } from 'crypto';
async function testR2() {
    const bucket = process.env.TEST_R2_BUCKET_NAME;
    const region = process.env.TEST_R2_REGION || 'auto';
    const endpoint = process.env.TEST_R2_ENDPOINT;
    const accessKeyId = process.env.TEST_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.TEST_R2_SECRET_ACCESS_KEY;
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
        console.error('Missing one or more required R2 environment variables.');
        process.exit(1);
    }
    const r2 = new R2StorageAdapter({
        bucket,
        region,
        endpoint,
        accessKeyId,
        secretAccessKey,
        forcePathStyle: true,
    });
    const testFileName = `test-r2-object-${randomBytes(8).toString('hex')}.txt`;
    const testFileContent = 'Hello from R2StorageAdapter test!';
    const testPath = `test-r2-adapter/${testFileName}`;
    const testFileName2 = `test-r2-object-2-${randomBytes(8).toString('hex')}.txt`;
    const testFileContent2 = 'Second test file content!';
    const testPath2 = `test-r2-adapter/${testFileName2}`;
    const testFileNameCopy = `test-r2-object-copy-${randomBytes(8).toString('hex')}.txt`;
    const testPathCopy = `test-r2-adapter/${testFileNameCopy}`;
    const customMetadata = { foo: 'bar', test: 'meta' };
    const listPrefix = 'test-r2-adapter/';
    try {
        console.log(`Testing R2StorageAdapter with bucket: ${bucket}, endpoint: ${endpoint}`);
        console.log(`Using test file path: ${testPath}`);
        // 1. Check if file exists (should be false)
        let exists = await r2.exists(testPath);
        console.log(`File exists: ${exists}`);
        if (exists) {
            console.warn('Test file unexpectedly exists. Attempting to delete before proceeding...');
            await r2.delete(testPath);
            console.log('Placeholder delete called.');
        }
        // 2. Write the file (with metadata)
        await r2.write(testPath, testFileContent, customMetadata);
        console.log('File written successfully.');
        // 2b. Write a second file for list testing
        await r2.write(testPath2, testFileContent2);
        console.log('Second file written successfully.');
        // 3. Read the file and verify content
        const fileBuffer = await r2.read(testPath);
        const contentRead = fileBuffer.toString();
        if (contentRead !== testFileContent) {
            throw new Error('Test failed: File content mismatch.');
        }
        console.log('File content verified successfully.');
        // 3b. getMetadata for the first file
        const metadata = await r2.getMetadata(testPath);
        if (!metadata || metadata.foo !== customMetadata.foo || metadata.test !== customMetadata.test) {
            throw new Error('Test failed: Metadata mismatch.');
        }
        console.log('Metadata verified successfully.');
        // 4. List files with prefix
        let files = await r2.list(listPrefix);
        if (!files.includes(testPath) || !files.includes(testPath2)) {
            throw new Error('Test failed: List missing files.');
        }
        console.log('List content verified successfully.');
        // 4b. Copy the first file to a new key
        await r2.copy(testPath, testPathCopy);
        const copyBuffer = await r2.read(testPathCopy);
        const copyContent = copyBuffer.toString();
        if (copyContent !== testFileContent) {
            throw new Error('Test failed: Copied file content mismatch.');
        }
        const copyMetadata = await r2.getMetadata(testPathCopy);
        if (!copyMetadata || copyMetadata.foo !== customMetadata.foo || copyMetadata.test !== customMetadata.test) {
            throw new Error('Test failed: Copied file metadata mismatch.');
        }
        console.log('Copy content and metadata verified successfully.');
        // 5. Check if first file exists (should be true)
        exists = await r2.exists(testPath);
        if (!exists) {
            throw new Error('Test failed: File does not exist after write operation.');
        }
        console.log('Exists after write verified.');
        // 6. Delete the files
        await r2.delete(testPath);
        await r2.delete(testPath2);
        await r2.delete(testPathCopy);
        console.log('Files deleted.');
        // 7. Verify files no longer exist
        exists = await r2.exists(testPath);
        if (exists)
            throw new Error('Test failed: First file not deleted.');
        exists = await r2.exists(testPath2);
        if (exists)
            throw new Error('Test failed: Second file not deleted.');
        exists = await r2.exists(testPathCopy);
        if (exists)
            throw new Error('Test failed: Copied file not deleted.');
        console.log('Files successfully verified as deleted.');
        console.log('\nR2StorageAdapter full (exists, write, read, list, delete, getMetadata, copy) test completed successfully!');
    }
    catch (error) {
        console.error('\nError during R2StorageAdapter test:');
        console.error(error);
        process.exit(1);
    }
}
testR2().catch(error => {
    console.error('Unhandled error in testR2:', error);
    process.exit(1);
});
