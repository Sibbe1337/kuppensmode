import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
export class S3StorageAdapter {
    client;
    bucketName;
    constructor(opts) {
        const { bucket, region, endpoint, forcePathStyle, accessKeyId, secretAccessKey, client } = opts;
        this.bucketName = bucket;
        if (client) {
            this.client = client;
        }
        else {
            const clientConfig = {
                region,
                endpoint,
                forcePathStyle,
            };
            if (accessKeyId && secretAccessKey) {
                clientConfig.credentials = {
                    accessKeyId,
                    secretAccessKey,
                };
            }
            this.client = new S3Client(clientConfig);
        }
    }
    async write(path, data, metadata = {}) {
        const isBig = Buffer.isBuffer(data) ? data.length > 5 * 1024 ** 2 : false;
        if (isBig) {
            const upload = new Upload({
                client: this.client,
                params: {
                    Bucket: this.bucketName,
                    Key: path,
                    Body: data,
                    Metadata: metadata,
                },
            });
            await upload.done();
        }
        else {
            await this.client.send(new PutObjectCommand({
                Bucket: this.bucketName,
                Key: path,
                Body: data,
                Metadata: metadata,
            }));
        }
    }
    async exists(path) {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: path }));
            return true;
        }
        catch (err) {
            if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
                return false;
            }
            throw err;
        }
    }
    async streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream)
            chunks.push(chunk);
        return Buffer.concat(chunks);
    }
    async read(path) {
        const { Body } = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: path }));
        if (!Body)
            throw new Error('Empty response body from S3');
        return this.streamToBuffer(Body);
    }
    async list(prefix) {
        const { Contents = [] } = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucketName, Prefix: prefix }));
        return Contents.map(obj => obj.Key).filter(Boolean);
    }
    async delete(path) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: path }));
    }
    async getMetadata(path) {
        try {
            const { Metadata } = await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: path }));
            return Metadata || {};
        }
        catch (err) {
            if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
                return null;
            }
            throw err;
        }
    }
    async copy(srcPath, destPath) {
        const copySource = `${this.bucketName}/${encodeURIComponent(srcPath)}`;
        await this.client.send(new CopyObjectCommand({
            Bucket: this.bucketName,
            CopySource: copySource,
            Key: destPath,
        }));
    }
}
