import { Storage, GetFilesOptions } from '@google-cloud/storage';
import type { StorageAdapter } from './StorageAdapter';

export interface GCSStorageAdapterOptions {
  bucket: string;
  client?: Storage;
}

export class GCSStorageAdapter implements StorageAdapter {
  private bucketName: string;
  private client: Storage;

  constructor(options: GCSStorageAdapterOptions) {
    this.bucketName = options.bucket;
    this.client = options.client || new Storage();
  }

  async write(
    path: string,
    data: Buffer | Uint8Array | string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const file = this.client.bucket(this.bucketName).file(path);
    await file.save(data, { metadata });
  }

  async read(path: string): Promise<Buffer> {
    const file = this.client.bucket(this.bucketName).file(path);
    const [contents] = await file.download();
    return contents;
  }

  async list(pathPrefix: string): Promise<string[]> {
    const options: GetFilesOptions = { prefix: pathPrefix };
    const [files] = await this.client.bucket(this.bucketName).getFiles(options);
    return files.map(f => f.name);
  }

  async delete(path: string): Promise<void> {
    const file = this.client.bucket(this.bucketName).file(path);
    await file.delete({ ignoreNotFound: true });
  }

  async exists(path: string): Promise<boolean> {
    const file = this.client.bucket(this.bucketName).file(path);
    const [exists] = await file.exists();
    return exists;
  }

  async getMetadata(path: string): Promise<Record<string, any> | null> {
    const file = this.client.bucket(this.bucketName).file(path);
    try {
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (err: any) {
      if (err.code === 404) return null;
      throw err;
    }
  }

  async copy(srcPath: string, destPath: string): Promise<void> {
    const srcFile = this.client.bucket(this.bucketName).file(srcPath);
    const destFile = this.client.bucket(this.bucketName).file(destPath);
    await srcFile.copy(destFile);
  }
} 