/**
 * Knowledge Base — shared types
 */
export class FileTooLargeError extends Error {
    constructor(name, sizeBytes, limitBytes) {
        super(`File "${name}" (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the ${(limitBytes / 1024 / 1024).toFixed(0)} MB upload limit`);
        this.name = "FileTooLargeError";
    }
}
export class StoreFullError extends Error {
    constructor(currentGb, maxGb) {
        super(`KB store is full: ${currentGb.toFixed(2)} GB used of ${maxGb} GB limit`);
        this.name = "StoreFullError";
    }
}
export class UnsupportedFormatError extends Error {
    constructor(ext) {
        super(`Unsupported file format: "${ext}". Supported: pdf, md, txt`);
        this.name = "UnsupportedFormatError";
    }
}
