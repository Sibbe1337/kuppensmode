export interface StorageAdapter {
  write(
    path: string,
    data: Buffer | Uint8Array | string,
    metadata?: Record<string, any>
  ): Promise<void>;

  read(path: string): Promise<Buffer>;

  list(pathPrefix: string): Promise<string[]>;

  delete(path: string): Promise<void>;

  exists(path: string): Promise<boolean>;

  // Optional helpers
  getMetadata?(path: string): Promise<Record<string, string> | null>;

  copy?(srcPath: string, destPath: string): Promise<void>;
} 