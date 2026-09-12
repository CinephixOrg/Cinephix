// RFC 4180 CSV reader.
//
// Replaces the stream-based `csv-parser` the old importers piped every file
// through. Import buffers are already fully in memory by the time they reach
// us (multer hands over a Buffer), so pushing them back through a Readable
// only to reassemble the rows costs an event-loop round trip per chunk and a
// Promise per file for no benefit. This walks the string once and slices each
// field out in a single operation.
//
// Handles the parts of the spec real exports actually use: quoted fields,
// embedded delimiters and newlines, "" escapes, CRLF, a UTF-8 BOM, and a
// trailing newline. Everything here is synchronous and pure, which is what
// makes the parse stage directly testable.

const QUOTE = 34; // "
const CR = 13;
const LF = 10;

// Strips the UTF-8 byte-order mark some exporters (notably Excel-roundtripped
// IMDb and Simkl files) put at the start. Left in place it becomes part of
// the first header name, and every lookup for that column silently misses.
export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Splits CSV text into an array of string arrays.
export function splitRows(text, delimiter = ",") {
  const src = stripBom(text);
  const delim = delimiter.charCodeAt(0);
  const len = src.length;
  const rows = [];
  let row = [];
  let i = 0;

  const atRowEnd = (code) => code === CR || code === LF;

  while (i < len) {
    let value;

    if (src.charCodeAt(i) === QUOTE) {
      // Quoted field: scan to the closing quote, collapsing "" pairs.
      i += 1;
      let start = i;
      let buf = "";
      while (i < len) {
        if (src.charCodeAt(i) === QUOTE) {
          if (src.charCodeAt(i + 1) === QUOTE) {
            buf += src.slice(start, i + 1); // keep one of the pair
            i += 2;
            start = i;
            continue;
          }
          break; // closing quote
        }
        i += 1;
      }
      value = buf ? buf + src.slice(start, i) : src.slice(start, i);
      if (i < len) i += 1; // consume the closing quote
      // Anything between the closing quote and the next delimiter/newline is
      // malformed padding. Drop it, the way a spreadsheet would.
      while (i < len && src.charCodeAt(i) !== delim && !atRowEnd(src.charCodeAt(i))) i += 1;
    } else {
      const start = i;
      while (i < len && src.charCodeAt(i) !== delim && !atRowEnd(src.charCodeAt(i))) i += 1;
      value = src.slice(start, i);
    }

    row.push(value);

    if (i >= len) break;

    if (src.charCodeAt(i) === delim) {
      i += 1;
      // A delimiter in final position means one more, empty, field.
      if (i >= len) row.push("");
      continue;
    }

    // Row terminator.
    if (src.charCodeAt(i) === CR && src.charCodeAt(i + 1) === LF) i += 2;
    else i += 1;
    rows.push(row);
    row = [];
  }

  if (row.length > 0) rows.push(row);
  return rows;
}

// Exports in the wild are comma-separated, but Kodi and some European
// spreadsheet round-trips emit semicolons or tabs. Detect from the header
// line rather than making every caller declare it.
export function detectDelimiter(text) {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] || "";
  let best = ",";
  let bestCount = 0;
  for (const candidate of [",", ";", "\t", "|"]) {
    const code = candidate.charCodeAt(0);
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const ch = firstLine.charCodeAt(i);
      if (ch === QUOTE) inQuotes = !inQuotes;
      else if (ch === code && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

// Parses CSV text into row objects keyed by header name.
//
// Headers are kept verbatim as keys — field lookup is case- and
// punctuation-insensitive at the mapping layer (see normalize.js's
// buildHeaderIndex), so normalizing them here would only lose information.
export function parseCsv(text, options = {}) {
  if (!text) return [];
  const delimiter = options.delimiter || detectDelimiter(text);
  const rows = splitRows(text, delimiter);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const width = header.length;
  const out = [];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    // A lone empty cell is what a blank line parses to — skip it rather than
    // emitting a row of empties every downstream guard has to defend against.
    if (cells.length === 1 && cells[0] === "") continue;
    const record = {};
    for (let c = 0; c < width; c += 1) {
      record[header[c]] = c < cells.length ? cells[c] : "";
    }
    out.push(record);
  }

  return out;
}
