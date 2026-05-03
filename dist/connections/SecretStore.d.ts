/**
 * SecretStore — AES-256-GCM file-based credential store.
 * Fallback when running outside Tauri (CLI / server-only mode).
 */
export declare function secretSave(key: string, value: string): void;
export declare function secretLoad(key: string): string | null;
export declare function secretDelete(key: string): void;
