    // packages/common-types/src/index.ts
    // export * from './storageProvider';
    // Add other exports here if you have more type definition files in this directory
    // For example:
    // export * from './user';
    // export * from './snapshot';
    // ... any other shared type files

    // packages/storage-adapters/src/index.ts
    export * from './StorageAdapter';
    export * from './GCSStorageAdapter';
    export * from './S3StorageAdapter';
    export * from './R2StorageAdapter';
    export * from './RedundantStorageAdapter';
    export * from './storageProvider';
    // Export options interfaces if they are defined in separate files and needed by consumers
    // export * from './GCSStorageAdapter'; // Assuming GCSStorageAdapterOptions is in GCSStorageAdapter.ts
    // export * from './S3StorageAdapter';  // Assuming S3AdapterOptions is in S3StorageAdapter.ts
    // export * from './R2StorageAdapter';  // Assuming R2AdapterOptions is in R2StorageAdapter.ts