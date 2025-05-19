"use strict";
// packages/common-types/src/index.ts
// export * from './storageProvider';
// Add other exports here if you have more type definition files in this directory
// For example:
// export * from './user';
// export * from './snapshot';
// ... any other shared type files
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// packages/storage-adapters/src/index.ts
__exportStar(require("./StorageAdapter"), exports);
__exportStar(require("./GCSStorageAdapter"), exports);
__exportStar(require("./S3StorageAdapter"), exports);
__exportStar(require("./R2StorageAdapter"), exports);
__exportStar(require("./RedundantStorageAdapter"), exports);
// Export options interfaces if they are defined in separate files and needed by consumers
// export * from './GCSStorageAdapter'; // Assuming GCSStorageAdapterOptions is in GCSStorageAdapter.ts
// export * from './S3StorageAdapter';  // Assuming S3AdapterOptions is in S3StorageAdapter.ts
// export * from './R2StorageAdapter';  // Assuming R2AdapterOptions is in R2StorageAdapter.ts
//# sourceMappingURL=index.js.map