/**
 * Document parser — PDF, Markdown, and plain-text.
 * Returns raw text + metadata for downstream chunking.
 */

import { UnsupportedFormatError } from "./types.js";
import type { FileFormat } from "./types.js";

export interface ParseResult {
  text: string;
  format: FileFormat;
  name: string;
}

/** Parse a Buffer into plain text based on the file extension. */
export async function parseBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return { text: data.text, format: "pdf", name: filename };
  }

  if (ext === "md" || ext === "markdown") {
    return { text: buffer.toString("utf-8"), format: "markdown", name: filename };
  }

  if (ext === "txt") {
    return { text: buffer.toString("utf-8"), format: "text", name: filename };
  }

  throw new UnsupportedFormatError(ext || "(no extension)");
}

/** Parse raw HTML string into plain text. */
export async function parseHtml(html: string, url: string): Promise<ParseResult> {
  const { load } = await import("cheerio");
  const $ = load(html);
  // Remove scripts, styles, nav boilerplate
  $("script, style, nav, header, footer, [aria-hidden='true']").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { text, format: "html", name: url };
}
