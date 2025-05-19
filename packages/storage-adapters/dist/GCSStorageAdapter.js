"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCSStorageAdapter = void 0;
const storage_1 = require("@google-cloud/storage");
class GCSStorageAdapter {
    constructor(options) {
        this.bucketName = options.bucket;
        this.client = options.client || new storage_1.Storage();
    }
    async write(path, data, metadata) {
        const file = this.client.bucket(this.bucketName).file(path);
        await file.save(data, { metadata });
    }
    async read(path) {
        const file = this.client.bucket(this.bucketName).file(path);
        const [contents] = await file.download();
        return contents;
    }
    async list(pathPrefix) {
        const options = { prefix: pathPrefix };
        const [files] = await this.client.bucket(this.bucketName).getFiles(options);
        return files.map(f => f.name);
    }
    async delete(path) {
        const file = this.client.bucket(this.bucketName).file(path);
        await file.delete({ ignoreNotFound: true });
    }
    async exists(path) {
        const file = this.client.bucket(this.bucketName).file(path);
        const [exists] = await file.exists();
        return exists;
    }
    async getMetadata(path) {
        const file = this.client.bucket(this.bucketName).file(path);
        try {
            const [metadata] = await file.getMetadata();
            return metadata;
        }
        catch (err) {
            if (err.code === 404)
                return null;
            throw err;
        }
    }
    async copy(srcPath, destPath) {
        const srcFile = this.client.bucket(this.bucketName).file(srcPath);
        const destFile = this.client.bucket(this.bucketName).file(destPath);
        await srcFile.copy(destFile);
    }
}
exports.GCSStorageAdapter = GCSStorageAdapter;
//# sourceMappingURL=GCSStorageAdapter.js.map