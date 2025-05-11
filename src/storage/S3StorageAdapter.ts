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
import type { StorageAdapter } from './StorageAdapter';
import { Readable } from 'node:stream';

export interface S3AdapterOptions {
  bucket: string;
  region?: string;
  endpoint?: string; // allow custom (R2, MinIO)
  forcePathStyle?: boolean; // true for R2 & some S3-compatible endpoints
}

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor(opts: S3AdapterOptions) {
    const { bucket, region, endpoint, forcePathStyle } = opts;
    this.bucket = bucket;

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
    });
  }

  /* ---------- helpers ---------- */

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  /* ---------- StorageAdapter impl ---------- */

  async write(
    path: string,
    data: Buffer | Uint8Array | string,
    metadata: Record<string, any> = {}
  ) {
    const isBig = Buffer.isBuffer(data) ? data.length > 5 * 1024 ** 2 : false;

    if (isBig) {
      // multipart upload for large files
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: path,
          Body: data as any,
          Metadata: metadata,
        },
      });
      await upload.done();
    } else {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: path,
          Body: data,
          Metadata: metadata,
        })
      );
    }
  }

  async read(path: string) {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path })
    );
    return this.streamToBuffer(Body as Readable);
  }

  async list(prefix: string) {
    const { Contents = [] } = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    return Contents.map(obj => obj.Key!).filter(Boolean);
  }

  async delete(path: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: path })
    );
  }

  async exists(path: string) {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: path })
      );
      return true;
    } catch (err: any) {
      return err?.$metadata?.httpStatusCode === 404 ? false : Promise.reject(err);
    }
  }

  async getMetadata(path: string) {
    const { Metadata } = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: path })
    );
    return Metadata ?? {};
  }

  async copy(src: string, dest: string) {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(src)}`,
        Key: dest,
      })
    );
  }
} 