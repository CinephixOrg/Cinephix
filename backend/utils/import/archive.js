// Upload unpacking.
//
// Stage 0 of the pipeline: **Upload** -> Normalize -> Match -> Save.
//
// The one module in utils/import that touches a binary format. Everything
// downstream works on `{ name, text }` records, which is what keeps the
// parse, normalize and match stages pure and directly testable.

import AdmZip from "adm-zip";
import { gunzipSync } from "node:zlib";

// A ZIP entry big enough to be a decompression bomb rather than a library.
// Even a 100k-title Letterboxd export is only a few MB of CSV.
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;

const TEXT_ENTRY = /\.(csv|json|xml|txt|tsv)$/i;

/**
 * Unpacks an uploaded buffer into text files.
 *
 * Accepts a ZIP (every source's archive export), a gzip (MyAnimeList ships
 * animelist.xml.gz), or a bare text file (a single CSV/JSON/XML).
 *
 * @returns {Array<{name: string, text: string}>}
 */
export function extractFiles(buffer, originalName = "") {
  if (!buffer || buffer.length === 0) return [];

  // ZIP local file header. Sniffed rather than trusted from the filename,
  // because pickers on both platforms rename things freely.
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return extractZip(buffer);
  }

  // gzip magic.
  if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    const inflated = gunzipSync(buffer, { maxOutputLength: MAX_ENTRY_BYTES });
    return [{ name: originalName.replace(/\.gz$/i, "") || "export.xml", text: inflated.toString("utf8") }];
  }

  return [{ name: originalName || "export.csv", text: buffer.toString("utf8") }];
}

function extractZip(buffer) {
  const zip = new AdmZip(buffer);
  const files = [];
  let total = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    // Normalize separators so a rule written as `likes/films.csv` matches an
    // archive built on Windows.
    const name = entry.entryName.replace(/\\/g, "/");
    // Skip macOS's resource-fork shadow copies, which otherwise parse as
    // garbage duplicates of every real entry.
    if (name.startsWith("__MACOSX/") || name.split("/").pop().startsWith("._")) continue;
    if (!TEXT_ENTRY.test(name)) continue;

    const size = entry.header.size;
    if (size > MAX_ENTRY_BYTES) continue;
    total += size;
    if (total > MAX_TOTAL_BYTES) break;

    files.push({ name, text: entry.getData().toString("utf8") });
  }

  return files;
}

// Identifies an upload for the idempotency cache. Content-addressed, so
// re-submitting the same export is recognised whatever the picker named it.
export function hashBuffer(buffer) {
  // FNV-1a over the buffer. Not cryptographic — this only has to make an
  // accidental double-submit recognisable, and it avoids pulling in crypto
  // for a value that never leaves the process.
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(buffer.length / 65536));
  for (let i = 0; i < buffer.length; i += step) {
    hash ^= buffer[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${buffer.length.toString(36)}.${hash.toString(36)}`;
}
