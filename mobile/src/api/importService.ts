import API from "./client";
import { API_ROUTES } from "../constants/apiRoutes";
import type { ImportResult } from "../types";

// Letterboxd imports can run tens of seconds to a couple minutes (live TMDB
// lookups per unmatched title, server-side); TV Time is local-DB-only but
// can still be slow for large libraries. client.ts sets no global axios
// timeout — this is a defensive cap, not a fix for a shorter default.
const IMPORT_TIMEOUT_MS = 180000;

// Both endpoints respond with Content-Type: text/event-stream and hold the
// POST open, writing `data: {...}\n\n` blocks as progress happens, then
// res.end()s after the final block. Axios doesn't stream in React Native —
// it resolves once the whole body has arrived — and since the content-type
// isn't application/json it never JSON-parses res.data, so res.data is the
// raw concatenated string of every block written during the request. This
// parses that string down to the one JSON block that carries a `status`
// field (progress blocks never do) and keeps the LAST such block, in case
// more than one somehow arrives.
function parseSseResult(raw: string): ImportResult {
  const blocks = raw
    .split("\n\n")
    .map((b) => b.trim())
    .filter((b) => b.startsWith("data:"));

  let result: ImportResult | null = null;
  for (const block of blocks) {
    const jsonText = block.slice("data:".length).trim();
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed.status === "string") {
        result = parsed;
      }
    } catch {
      // Malformed/truncated block — skip it and keep looking.
    }
  }

  if (!result) {
    throw new Error("Import finished but no result could be read from the server response.");
  }
  return result;
}

async function uploadImportZip(endpoint: string, fileUri: string, fileName: string): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("zipFile", {
    uri: fileUri,
    name: fileName || "export.zip",
    type: "application/zip",
  } as any);

  const res = await API.post(endpoint, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: IMPORT_TIMEOUT_MS,
  });
  // res.data is the raw SSE string here — client.ts's response interceptor
  // is a no-op on it (property probes on a string just yield undefined).
  return parseSseResult(res.data as unknown as string);
}

export async function importFromTVTime(fileUri: string, fileName: string): Promise<ImportResult> {
  return uploadImportZip(API_ROUTES.IMPORT.TVTIME, fileUri, fileName);
}

export async function importFromLetterboxd(fileUri: string, fileName: string): Promise<ImportResult> {
  return uploadImportZip(API_ROUTES.IMPORT.LETTERBOXD, fileUri, fileName);
}
