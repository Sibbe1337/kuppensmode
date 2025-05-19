"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedundantStorageAdapter = void 0;
// Define a type for network-like errors that might be retried.
// This is a simplified check; real-world usage might inspect error codes or use a more robust library.
const isRetryableError = (error) => {
    if (error instanceof Error) {
        const retryableMessages = ['network timeout', 'socket hang up', 'connection timed out', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH'];
        return retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
    }
    return false;
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
class RedundantStorageAdapter {
    constructor(primary, mirrors = []) {
        this.defaultRetryAttempts = 1; // Minimal retry (1 extra attempt)
        this.retryDelayMs = 500;
        this.primary = primary;
        this.mirrors = mirrors;
    }
    async attemptWithRetry(fn, attempts = this.defaultRetryAttempts) {
        try {
            return await fn();
        }
        catch (error) {
            if (attempts > 0 && isRetryableError(error)) {
                console.warn(`Retrying operation due to retryable error: ${error.message}. Attempts left: ${attempts}`);
                await sleep(this.retryDelayMs);
                return this.attemptWithRetry(fn, attempts - 1);
            }
            throw error;
        }
    }
    async write(path, data, metadata) {
        const allAdapters = [this.primary, ...this.mirrors];
        const results = await Promise.allSettled(allAdapters.map(adapter => this.attemptWithRetry(() => adapter.write(path, data, metadata))));
        const successfulWrites = results.filter(result => result.status === 'fulfilled').length;
        if (successfulWrites === 0 && allAdapters.length > 0) {
            const errors = results
                .filter(result => result.status === 'rejected')
                // @ts-ignore
                .map(result => result.reason?.message || result.reason || 'Unknown error');
            console.error(`Redundant write failed for all adapters for path: ${path}`, errors);
            throw new Error(`All storage writes failed for path ${path}. Errors: ${errors.join('; ')}`);
        }
        else if (successfulWrites < allAdapters.length) {
            console.warn(`Redundant write for path ${path} was successful on ${successfulWrites}/${allAdapters.length} adapters.`);
            // Potentially log which ones failed if needed, but operation is considered successful if at least one primary write was targeted.
            // For now, if primary failed but a mirror succeeded, it's a partial success.
            // If primary was among the successful, it's a success.
            // The task says "fail if *all* fail", which is handled by the throw above.
        }
        // If at least one succeeded (implicitly, if no error thrown), resolve.
    }
    async read(path) {
        try {
            return await this.attemptWithRetry(() => this.primary.read(path));
        }
        catch (primaryError) {
            console.warn(`Primary adapter failed to read ${path}: ${primaryError.message}. Trying mirrors.`);
            for (const mirror of this.mirrors) {
                try {
                    return await this.attemptWithRetry(() => mirror.read(path));
                }
                catch (mirrorError) {
                    console.warn(`Mirror adapter failed to read ${path}: ${mirrorError.message}. Trying next.`);
                }
            }
            throw new Error(`Failed to read ${path} from primary and all mirrors. Last primary error: ${primaryError.message}`);
        }
    }
    async list(pathPrefix) {
        // List is usually performed on primary, as mirrors might not be perfectly in sync
        // or the definition of "list" might be primary-authoritative.
        try {
            return await this.attemptWithRetry(() => this.primary.list(pathPrefix));
        }
        catch (primaryError) {
            console.warn(`Primary adapter failed to list ${pathPrefix}: ${primaryError.message}. Trying mirrors if available.`);
            if (this.mirrors.length > 0) {
                for (const mirror of this.mirrors) {
                    try {
                        return await this.attemptWithRetry(() => mirror.list(pathPrefix));
                    }
                    catch (mirrorError) {
                        console.warn(`Mirror adapter failed to list ${pathPrefix}: ${mirrorError.message}. Trying next.`);
                    }
                }
            }
            throw new Error(`Failed to list ${pathPrefix} from primary and all mirrors. Last primary error: ${primaryError.message}`);
        }
    }
    async delete(path) {
        const allAdapters = [this.primary, ...this.mirrors];
        const results = await Promise.allSettled(allAdapters.map(adapter => this.attemptWithRetry(() => adapter.delete(path), 0) // 0 retries for delete for fire-and-forget
        ));
        const firstFulfilled = results.find(result => result.status === 'fulfilled');
        if (firstFulfilled) {
            // Log if some failed but at least one (hopefully primary) succeeded.
            const failedDeletes = results.filter(r => r.status === 'rejected').length;
            if (failedDeletes > 0) {
                console.warn(`Redundant delete for ${path}: ${failedDeletes}/${allAdapters.length} adapters failed, but at least one succeeded.`);
            }
            return; // Returns on first fulfilled (fire-and-forget characteristic)
        }
        // If all failed
        const errors = results
            .filter(result => result.status === 'rejected')
            // @ts-ignore
            .map(result => result.reason?.message || result.reason || 'Unknown error');
        console.error(`Redundant delete failed for all adapters for path: ${path}`, errors);
        throw new Error(`All storage deletes failed for path ${path}. Errors: ${errors.join('; ')}`);
    }
    async exists(path) {
        try {
            if (await this.attemptWithRetry(() => this.primary.exists(path))) {
                return true;
            }
        }
        catch (primaryError) {
            console.warn(`Primary adapter failed on exists for ${path}: ${primaryError.message}. Trying mirrors.`);
        }
        for (const mirror of this.mirrors) {
            try {
                if (await this.attemptWithRetry(() => mirror.exists(path))) {
                    return true;
                }
            }
            catch (mirrorError) {
                console.warn(`Mirror adapter failed on exists for ${path}: ${mirrorError.message}. Trying next.`);
            }
        }
        return false;
    }
    async getMetadata(path) {
        // Optional method, attempt on primary first, then mirrors.
        if (this.primary.getMetadata) {
            try {
                return await this.attemptWithRetry(() => this.primary.getMetadata(path));
            }
            catch (primaryError) {
                console.warn(`Primary adapter failed getMetadata for ${path}: ${primaryError.message}. Trying mirrors.`);
                for (const mirror of this.mirrors) {
                    if (mirror.getMetadata) {
                        try {
                            return await this.attemptWithRetry(() => mirror.getMetadata(path));
                        }
                        catch (mirrorError) {
                            console.warn(`Mirror adapter failed getMetadata for ${path}: ${mirrorError.message}. Trying next.`);
                        }
                    }
                }
            }
        }
        // If primary doesn't have it or all attempts failed, try mirrors that have it
        for (const mirror of this.mirrors) {
            if (mirror.getMetadata) {
                try {
                    return await this.attemptWithRetry(() => mirror.getMetadata(path), 0); // No extra retry if already tried primary
                }
                catch (mirrorError) {
                    // warning already logged if primary also failed
                }
            }
        }
        console.warn(`getMetadata for ${path} failed on primary and all mirrors, or method not implemented.`);
        return null; // Or throw, depending on desired strictness for optional methods
    }
    async copy(srcPath, destPath) {
        // Copy is a complex operation for redundancy. 
        // Simplest: Perform on primary only. Assumes primary is the source of truth for such ops.
        // More complex: copy on primary, then try to ensure consistency on mirrors (could be tricky).
        // For now, primary only, as per typical design for non-idempotent or state-changing ops.
        if (!this.primary.copy) {
            throw new Error('Copy method not implemented on primary adapter.');
        }
        try {
            return await this.attemptWithRetry(() => this.primary.copy(srcPath, destPath));
        }
        catch (e) {
            console.error(`Failed to copy ${srcPath} to ${destPath} on primary adapter: ${e.message}`);
            throw e;
        }
    }
}
exports.RedundantStorageAdapter = RedundantStorageAdapter;
//# sourceMappingURL=RedundantStorageAdapter.js.map