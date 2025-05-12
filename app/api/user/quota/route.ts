import { StorageAdapter } from './StorageAdapter';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Minimal S3 implementation that satisfies the StorageAdapter interface.
 * Only `write` and `exists` are fully functional for now; the rest throw
 * “Not implemented” so we can flesh them out incrementally.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(params: {
    region: string;
    bucket: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
  }) {
    this.bucket = params.bucket;
    this.client = new S3Client({
      region: params.region,
      credentials: params.credentials,
    });
  }

  /** Uploads a file or buffer to the configured S3 bucket. */
  async write(
    path: string,
    data: Buffer | Uint8Array | string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const body = typeof data === 'string' ? Buffer.from(data) : data;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: body,
        Metadata: metadata,
      }),
    );
  }

  /** Checks whether a given object key exists in the bucket. */
  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: path }),
      );
      return true;
    } catch (err: any) {
      // The AWS SDK throws a 404-style error for missing objects.
      if (err?.$metadata?.httpStatusCode === 404) return false;
      throw err; // Bubble up non‑404 errors
    }
  }

  // ---------------------------------------------------------------------------
  // Stub implementations — satisfy interface but clearly signal “todo”.
  // ---------------------------------------------------------------------------

  async read(_path: string): Promise<Buffer> {
    throw new Error('S3StorageAdapter.read() not implemented yet');
  }

  async list(_prefix: string): Promise<string[]> {
    throw new Error('S3StorageAdapter.list() not implemented yet');
  }

  async delete(_path: string): Promise<void> {
    throw new Error('S3StorageAdapter.delete() not implemented yet');
  }

  async getMetadata(_path: string): Promise<Record<string, any> | null> {
    throw new Error('S3StorageAdapter.getMetadata() not implemented yet');
  }

  async copy(_srcPath: string, _destPath: string): Promise<void> {
    throw new Error('S3StorageAdapter.copy() not implemented yet');
  }
}