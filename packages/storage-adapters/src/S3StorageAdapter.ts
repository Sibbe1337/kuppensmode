import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  S3ClientConfig,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { StorageAdapter } from './StorageAdapter';
import { Readable } from 'node:stream';

export interface S3AdapterOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  client?: S3Client;
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucketName: string;

  constructor(opts: S3AdapterOptions) {
    const { bucket, region, endpoint, forcePathStyle, accessKeyId, secretAccessKey, client } = opts;
    this.bucketName = bucket;

    if (client) {
      this.client = client;
    } else {
      const clientConfig: S3ClientConfig = {
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
          Body: data as any,
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

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async read(path: string): Promise<Buffer> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: path })
    );
    if (!Body) throw new Error('Empty response body from S3');
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

  async getMetadata(path: string): Promise<Record<string, any> | null> {
    try {
      const { Metadata } = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: path })
      );
      return Metadata || {};
    } catch (err: any) {
      if (err.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async copy(srcPath: string, destPath: string): Promise<void> {
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