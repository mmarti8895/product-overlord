/**
 * SecretStore — AES-256-GCM file-based credential store.
 * Fallback when running outside Tauri (CLI / server-only mode).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import os from "os";
const STORE_DIR = process.env.CREDENTIAL_STORE_PATH ?? join(os.homedir(), ".overlord", "credentials");
const ALGO = "aes-256-gcm";
const SALT_FILE = join(STORE_DIR, ".salt");
function ensureDir() {
    if (!existsSync(STORE_DIR))
        mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
}
function getMachineKey() {
    ensureDir();
    let salt;
    if (existsSync(SALT_FILE)) {
        salt = Buffer.from(readFileSync(SALT_FILE, "utf8"), "hex");
    }
    else {
        salt = randomBytes(32);
        writeFileSync(SALT_FILE, salt.toString("hex"), { mode: 0o600 });
    }
    const passphrase = `${os.hostname()}-${process.getuid?.() ?? 0}`;
    return scryptSync(passphrase, salt, 32);
}
export function secretSave(key, value) {
    ensureDir();
    const masterKey = getMachineKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGO, masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const record = {
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        ciphertext: ciphertext.toString("hex"),
    };
    writeFileSync(join(STORE_DIR, `${encodeURIComponent(key)}.enc`), JSON.stringify(record), { mode: 0o600 });
}
export function secretLoad(key) {
    ensureDir();
    const filePath = join(STORE_DIR, `${encodeURIComponent(key)}.enc`);
    if (!existsSync(filePath))
        return null;
    try {
        const masterKey = getMachineKey();
        const record = JSON.parse(readFileSync(filePath, "utf8"));
        const decipher = createDecipheriv(ALGO, masterKey, Buffer.from(record.iv, "hex"));
        decipher.setAuthTag(Buffer.from(record.authTag, "hex"));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(record.ciphertext, "hex")),
            decipher.final(),
        ]);
        return plaintext.toString("utf8");
    }
    catch {
        return null;
    }
}
export function secretDelete(key) {
    const filePath = join(STORE_DIR, `${encodeURIComponent(key)}.enc`);
    if (existsSync(filePath)) {
        writeFileSync(filePath, randomBytes(64).toString("hex"), { mode: 0o600 });
        try {
            unlinkSync(filePath);
        }
        catch { /* ignore */ }
    }
}
