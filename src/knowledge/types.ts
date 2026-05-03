/**
 * Knowledge Base — shared types
 */

export type SourceType = "kt" | "code";
export type FileFormat = "pdf" | "markdown" | "text" | "html";

export interface KBChunk {
  chunk_id: string;
  source_id: string;
  source_type: SourceType;
  project_key: string;
  text: string;
  chunk_index: number;
  file_path?: string;
  url?: string;
  vector?: number[];
}

export interface KBSource {
  source_id: string;
  project_key: string;
  source_type: SourceType;
  format: FileFormat;
  name: string;
  /** Original file name or URL */
  origin: string;
  chunk_count: number;
  indexed_at: string;
  size_bytes: number;
}

export interface RetrievedChunk {
  source_id: string;
  source_type: SourceType;
  file_path?: string;
  url?: string;
  text: string;
  /** Cosine similarity score 0–1 */
  score: number;
}

export interface IngestResult {
  source_id: string;
  chunk_count: number;
  size_bytes: number;
  indexed_at: string;
}

export class FileTooLargeError extends Error {
  constructor(name: string, sizeBytes: number, limitBytes: number) {
    super(
      `File "${name}" (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the ${(limitBytes / 1024 / 1024).toFixed(0)} MB upload limit`
    );
    this.name = "FileTooLargeError";
  }
}

export class StoreFullError extends Error {
  constructor(currentGb: number, maxGb: number) {
    super(`KB store is full: ${currentGb.toFixed(2)} GB used of ${maxGb} GB limit`);
    this.name = "StoreFullError";
  }
}

export class UnsupportedFormatError extends Error {
  constructor(ext: string) {
    super(`Unsupported file format: "${ext}". Supported: pdf, md, txt`);
    this.name = "UnsupportedFormatError";
  }
}
