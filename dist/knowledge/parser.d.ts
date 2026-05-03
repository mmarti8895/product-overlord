/**
 * Document parser — PDF, Markdown, and plain-text.
 * Returns raw text + metadata for downstream chunking.
 */
import type { FileFormat } from "./types.js";
export interface ParseResult {
    text: string;
    format: FileFormat;
    name: string;
}
/** Parse a Buffer into plain text based on the file extension. */
export declare function parseBuffer(buffer: Buffer, filename: string): Promise<ParseResult>;
/** Parse raw HTML string into plain text. */
export declare function parseHtml(html: string, url: string): Promise<ParseResult>;
