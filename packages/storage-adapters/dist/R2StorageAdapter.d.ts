import type { StorageAdapter } from './StorageAdapter';
export interface R2AdapterOptions {
    bucket: string;
    region?: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
}
export declare class R2StorageAdapter implements StorageAdapter {
    private client;
    private bucketName;
    constructor(opts: R2AdapterOptions);
    private streamToBuffer;
    write(path: string, data: Buffer | Uint8Array | string, metadata?: Record<string, any>): Promise<void>;
    read(path: string): Promise<Buffer>;
    list(prefix: string): Promise<string[]>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    getMetadata(path: string): Promise<Record<string, any>>;
    copy(srcPath: string, destPath: string): Promise<void>;
}
//# sourceMappingURL=R2StorageAdapter.d.ts.map