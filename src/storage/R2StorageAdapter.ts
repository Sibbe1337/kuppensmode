import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { StorageAdapter } from './StorageAdapter'; // Using non-.js for CommonJS compatibility
import { Readable } from 'node:stream';

// Re-using S3AdapterOptions for R2 as structure is identical for S3-compatible APIs
export interface R2AdapterOptions {
  bucket: string;
  region?: string; // R2 typically uses 'auto' or a specific region hint
  endpoint: string; // REQUIRED: e.g., https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean; // Often true for R2
}

export class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor(opts: R2AdapterOptions) {
    const { bucket, region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = opts;
    this.bucketName = bucket;

    this.client = new S3Client({
      region: region || 'auto', // R2 often uses 'auto'
      endpoint,
      forcePathStyle: forcePathStyle === undefined ? true : forcePathStyle, // Default to true for R2
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async write(
    path: string,
    data: Buffer | Uint8Array | string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const isBig = Buffer.isBuffer(data) ? data.length > 5 * 1024 ** 2 : false;

    if (isBig) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: path,
          Body: data as any, // Upload supports Buffer, Readable, string
          Metadata: metadata,
        },
      });
      await upload.done();
    } else {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: path,
          Body: data,
          Metadata: metadata,
        })
      );
    }
  }

  async read(path: string): Promise<Buffer> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: path })
    );
    if (!Body) throw new Error('Empty response body from R2');
    return this.streamToBuffer(Body as Readable);
  }

  async list(prefix: string): Promise<string[]> {
    const { Contents = [] } = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucketName, Prefix: prefix })
    );
    return Contents.map(obj => obj.Key!).filter(Boolean) as string[];
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: path })
    );
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: path })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async getMetadata(path: string): Promise<Record<string, any>> {
    try {
      const { Metadata } = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: path })
      );
      return Metadata || {}; // Ensure an object is returned even if Metadata is undefined
    } catch (err: any) {
      if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new Error(`Object not found at path: ${path}`); // Or return null/empty object as per contract
      }
      throw err;
    }
  }

  async copy(srcPath: string, destPath: string): Promise<void> {
    // R2/S3 copy source needs to be <bucket>/<key>
    const copySource = `${this.bucketName}/${encodeURIComponent(srcPath)}`;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: copySource,
        Key: destPath,
      })
    );
  }
} 