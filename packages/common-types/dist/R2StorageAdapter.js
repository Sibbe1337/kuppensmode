"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.R2StorageAdapter = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const lib_storage_1 = require("@aws-sdk/lib-storage");
class R2StorageAdapter {
    constructor(opts) {
        const { bucket, region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = opts;
        this.bucketName = bucket;
        this.client = new client_s3_1.S3Client({
            region: region || 'auto', // R2 often uses 'auto'
            endpoint,
            forcePathStyle: forcePathStyle === undefined ? true : forcePathStyle, // Default to true for R2
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream)
            chunks.push(chunk);
        return Buffer.concat(chunks);
    }
    async write(path, data, metadata = {}) {
        const isBig = Buffer.isBuffer(data) ? data.length > 5 * 1024 ** 2 : false;
        if (isBig) {
            const upload = new lib_storage_1.Upload({
                client: this.client,
                params: {
                    Bucket: this.bucketName,
                    Key: path,
                    Body: data, // Upload supports Buffer, Readable, string
                    Metadata: metadata,
                },
            });
            await upload.done();
        }
        else {
            await this.client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: path,
                Body: data,
                Metadata: metadata,
            }));
        }
    }
    async read(path) {
        const { Body } = await this.client.send(new client_s3_1.GetObjectCommand({ Bucket: this.bucketName, Key: path }));
        if (!Body)
            throw new Error('Empty response body from R2');
        return this.streamToBuffer(Body);
    }
    async list(prefix) {
        const { Contents = [] } = await this.client.send(new client_s3_1.ListObjectsV2Command({ Bucket: this.bucketName, Prefix: prefix }));
        return Contents.map(obj => obj.Key).filter(Boolean);
    }
    async delete(path) {
        await this.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucketName, Key: path }));
    }
    async exists(path) {
        try {
            await this.client.send(new client_s3_1.HeadObjectCommand({ Bucket: this.bucketName, Key: path }));
            return true;
        }
        catch (err) {
            if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw err;
        }
    }
    async getMetadata(path) {
        try {
            const { Metadata } = await this.client.send(new client_s3_1.HeadObjectCommand({ Bucket: this.bucketName, Key: path }));
            return Metadata || {}; // Ensure an object is returned even if Metadata is undefined
        }
        catch (err) {
            if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
                throw new Error(`Object not found at path: ${path}`); // Or return null/empty object as per contract
            }
            throw err;
        }
    }
    async copy(srcPath, destPath) {
        // R2/S3 copy source needs to be <bucket>/<key>
        const copySource = `${this.bucketName}/${encodeURIComponent(srcPath)}`;
        await this.client.send(new client_s3_1.CopyObjectCommand({
            Bucket: this.bucketName,
            CopySource: copySource,
            Key: destPath,
        }));
    }
}
exports.R2StorageAdapter = R2StorageAdapter;
//# sourceMappingURL=R2StorageAdapter.js.map