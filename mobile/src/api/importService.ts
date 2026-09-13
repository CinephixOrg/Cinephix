import * as SecureStore from "expo-secure-store";
import API, { API_BASE_URL } from "./client";
import { API_ROUTES, STORAGE_KEYS } from "../constants/apiRoutes";
import type { ImportProgress, ImportResult, ImportSourceId, ImportSourceInfo } from "../types";

// A large library can take a couple of minutes server-side: live TMDB
// lookups for titles the catalogue has never seen dominate. client.ts sets
// no global timeout, so this is a deliberate ceiling rather than a fix for a
// shorter default.
const IMPORT_TIMEOUT_MS = 300000;

// ---------------------------------------------------------------------------
// Source catalogue
// ---------------------------------------------------------------------------

// The catalogue is static for the life of a deploy, so it is fetched once per
// app session and then served from memory. The screen renders instantly on
// every visit after the first, and a failed fetch falls back to the built-in
// list below rather than leaving the user with no way to import.
let cachedSources: ImportSourceInfo[] | null = null;
let inFlight: Promise<ImportSourceInfo[]> | null = null;

// Mirrors the server catalogue. Used before the request lands and if it
// fails — the server still validates the source, so a stale entry here can
// only ever produce a clear error, never a wrong import.
export const FALLBACK_SOURCES: ImportSourceInfo[] = [
  { id: "letterboxd", label: "Letterboxd", accepts: [".zip", ".csv"], kinds: ["movie"] },
  { id: "tvtime", label: "TV Time", accepts: [".zip", ".json", ".csv"], kinds: ["movie", "series"] },
  { id: "trakt", label: "Trakt", accepts: [".zip", ".json", ".csv"], kinds: ["movie", "series"] },
  { id: "imdb", label: "IMDb", accepts: [".csv", ".zip"], kinds: ["movie", "series"] },
  { id: "simkl", label: "Simkl", accepts: [".csv", ".json", ".zip"], kinds: ["movie", "series"] },
  { id: "plex", label: "Plex", accepts: [".csv", ".json", ".zip"], kinds: ["movie", "series"] },
  { id: "jellyfin", label: "Jellyfin", accepts: [".csv", ".json", ".zip"], kinds: ["movie", "series"] },
  { id: "kodi", label: "Kodi", accepts: [".csv", ".json", ".zip"], kinds: ["movie", "series"] },
  { id: "myanimelist", label: "MyAnimeList", accepts: [".xml", ".gz", ".zip", ".csv"], kinds: ["series"] },
  { id: "anilist", label: "AniList", accepts: [".json", ".zip", ".csv"], kinds: ["series"] },
  { id: "kitsu", label: "Kitsu", accepts: [".json", ".csv", ".zip"], kinds: ["series"] },
  { id: "generic", label: "Generic CSV / JSON", accepts: [".csv", ".json", ".zip"], kinds: ["movie", "series"] },
];

export function getCachedImportSources(): ImportSourceInfo[] {
  return cachedSources ?? FALLBACK_SOURCES;
}

export function fetchImportSources(): Promise<ImportSourceInfo[]> {
  if (cachedSources) return Promise.resolve(cachedSources);
  // One request even if the screen mounts twice in quick succession.
  if (inFlight) return inFlight;

  inFlight = API.get(API_ROUTES.IMPORT.SOURCES)
    .then((res) => {
      const sources = (res.data as { sources?: ImportSourceInfo[] })?.sources;
      cachedSources = Array.isArray(sources) && sources.length > 0 ? sources : FALLBACK_SOURCES;
      return cachedSources;
    })
    .catch(() => FALLBACK_SOURCES)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// ---------------------------------------------------------------------------
// Running an import
// ---------------------------------------------------------------------------

// The server answers with text/event-stream, writing one `data: {...}` block
// per step and a final block carrying `status`. Blocks are separated by a
// blank line, so a partial response can always be split safely on "\n\n" —
// anything after the last separator is an incomplete block and is kept for
// the next chunk.
function readBlocks(buffer: string): { parsed: unknown[]; rest: string } {
  const pieces = buffer.split("\n\n");
  // The final piece has no terminator yet.
  const rest = pieces.pop() ?? "";
  const parsed: unknown[] = [];

  for (const piece of pieces) {
    const trimmed = piece.trim();
    if (!trimmed.startsWith("data:")) continue;
    const json = trimmed.slice("data:".length).trim();
    if (!json) continue;
    try {
      parsed.push(JSON.parse(json));
    } catch {
      // Truncated or malformed — the next chunk cannot repair a block that
      // already had its terminator, so drop it.
    }
  }

  return { parsed, rest };
}

const isResult = (block: unknown): block is ImportResult =>
  typeof block === "object" && block !== null && typeof (block as { status?: unknown }).status === "string";

export interface RunImportOptions {
  sourceId: ImportSourceId;
  fileUri: string;
  fileName: string;
  mimeType?: string;
  onProgress?: (progress: ImportProgress) => void;
  /** Called with the raw XHR so a caller can abort; used by the screen's cancel. */
  onStart?: (abort: () => void) => void;
}

/**
 * Uploads an export and resolves with the server's final summary.
 *
 * Uses XMLHttpRequest rather than axios deliberately. Axios in React Native
 * resolves only once the whole body has arrived, so an axios import can show
 * nothing but a spinner for two minutes. XHR exposes `responseText` as it
 * accumulates, which lets the SSE progress blocks drive a real progress bar.
 */
export function runImport(options: RunImportOptions): Promise<ImportResult> {
  const { sourceId, fileUri, fileName, mimeType, onProgress, onStart } = options;

  return new Promise(async (resolve, reject) => {
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN);
    } catch {
      // Falls through to an unauthenticated request, which the server
      // rejects with a clear message.
    }

    const form = new FormData();
    form.append("source", sourceId);
    form.append("file", {
      uri: fileUri,
      name: fileName || "export",
      type: mimeType || "application/octet-stream",
    } as unknown as Blob);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${API_ROUTES.IMPORT.RUN}`);
    xhr.timeout = IMPORT_TIMEOUT_MS;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Leave Content-Type unset: the runtime fills in the multipart boundary.

    let consumed = 0;
    let carry = "";
    let result: ImportResult | null = null;
    let aborted = false;

    // Only the bytes that arrived since the last event are parsed, so the
    // cost of following a long stream stays flat instead of re-scanning the
    // whole response on every chunk.
    const drain = () => {
      const text = xhr.responseText ?? "";
      if (text.length <= consumed) return;
      carry += text.slice(consumed);
      consumed = text.length;

      const { parsed, rest } = readBlocks(carry);
      carry = rest;

      for (const block of parsed) {
        if (isResult(block)) result = block;
        else if (onProgress) onProgress(block as ImportProgress);
      }
    };

    xhr.onprogress = drain;

    xhr.onload = () => {
      drain();
      if (result) return resolve(result);
      if (xhr.status >= 400) {
        return reject(new Error(`The server rejected the import (${xhr.status}).`));
      }
      reject(new Error("The import finished but the server sent no result."));
    };

    xhr.onerror = () => {
      if (!aborted) reject(new Error("The upload failed. Check your connection and try again."));
    };
    xhr.ontimeout = () => reject(new Error("The import timed out. Try again, or split a very large export."));
    xhr.onabort = () => {
      aborted = true;
      reject(new Error("Import cancelled."));
    };

    onStart?.(() => xhr.abort());
    xhr.send(form);
  });
}
