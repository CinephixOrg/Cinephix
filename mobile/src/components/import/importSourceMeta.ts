import type { Ionicons } from "@expo/vector-icons";
import type { ImportSourceId } from "../../types";

export interface SourceMeta {
  icon: keyof typeof Ionicons.glyphMap;
  /** Brand colour, used for the icon and a tinted plate behind it. Kept off
   *  text and backgrounds so every theme stays readable. */
  tint: string;
  /** How to get the export file out of that platform. Translated at render. */
  steps: string[];
  /** Shown under the file picker, e.g. "letterboxd-yourname.zip". */
  fileHint: string;
}

// Per-platform knowledge the UI needs. The server's catalogue supplies the
// id, label and accepted extensions; this adds only presentation.
export const SOURCE_META: Record<ImportSourceId, SourceMeta> = {
  letterboxd: {
    icon: "film-outline",
    tint: "#00E054",
    steps: [
      "Open Letterboxd on the web and go to Settings → Data.",
      "Choose Export Your Data and save the ZIP file.",
      "Upload that ZIP here — watched films, ratings, likes and your watchlist all come across.",
    ],
    fileHint: "letterboxd-username.zip",
  },
  tvtime: {
    icon: "tv-outline",
    tint: "#FB6B6B",
    steps: [
      "Open TV Time on the web and go to your account settings.",
      "Request a data export and wait for the email with your archive.",
      "Upload the ZIP — watched episodes and movie ratings both come across.",
    ],
    fileHint: "tvtime-export.zip",
  },
  trakt: {
    icon: "play-circle-outline",
    tint: "#ED1C24",
    steps: [
      "Open Trakt on the web and go to Settings → Data.",
      "Request an export of your history, ratings and watchlist.",
      "Upload the ZIP or any single JSON file from it.",
    ],
    fileHint: "trakt-export.zip",
  },
  imdb: {
    icon: "star-outline",
    tint: "#F5C518",
    steps: [
      "Open IMDb on the web and go to Your Ratings.",
      "Use Export to download ratings.csv; your watchlist exports the same way.",
      "Upload the CSV — both films and series are recognised.",
    ],
    fileHint: "ratings.csv",
  },
  simkl: {
    icon: "sync-outline",
    tint: "#0F9BD7",
    steps: [
      "Open Simkl on the web and go to Settings → Import & Export.",
      "Export your list as CSV or JSON.",
      "Upload the file — Simkl's own IDs make matching very accurate.",
    ],
    fileHint: "SimklBackup.csv",
  },
  plex: {
    icon: "server-outline",
    tint: "#E5A00D",
    steps: [
      "Open your Plex library in a browser.",
      "Export the library to CSV, or use a Plex export tool of your choice.",
      "Upload the CSV — view counts become watched, star ratings become ratings.",
    ],
    fileHint: "plex-library.csv",
  },
  jellyfin: {
    icon: "cloud-outline",
    tint: "#AA5CC3",
    steps: [
      "Open your Jellyfin dashboard.",
      "Export your library or playback report as CSV or JSON.",
      "Upload the file — played items and user ratings come across.",
    ],
    fileHint: "jellyfin-library.csv",
  },
  kodi: {
    icon: "desktop-outline",
    tint: "#17B2E7",
    steps: [
      "In Kodi, go to Settings → Media → Library → Export library.",
      "Export to a single file as CSV or JSON.",
      "Upload it — play counts and user ratings come across.",
    ],
    fileHint: "kodi-library.csv",
  },
  myanimelist: {
    icon: "logo-octocat",
    tint: "#2E51A2",
    steps: [
      "Open MyAnimeList on the web and go to List → Export.",
      "Export your anime list; MAL gives you an XML file, usually gzipped.",
      "Upload it as-is — there is no need to unzip it first.",
    ],
    fileHint: "animelist.xml.gz",
  },
  anilist: {
    icon: "color-wand-outline",
    tint: "#02A9FF",
    steps: [
      "Open AniList on the web and go to Settings → Apps or use an export tool.",
      "Export your anime list as JSON.",
      "Upload it — whichever scoring scale you use is detected automatically.",
    ],
    fileHint: "anilist-export.json",
  },
  kitsu: {
    icon: "paw-outline",
    tint: "#FD755C",
    steps: [
      "Open Kitsu on the web and go to your library settings.",
      "Export your library as JSON or CSV.",
      "Upload the file — progress and ratings both come across.",
    ],
    fileHint: "kitsu-library.json",
  },
  generic: {
    icon: "document-text-outline",
    tint: "#8B95A5",
    steps: [
      "Use any CSV or JSON file with one row per title.",
      "Include a Title column, and ideally Year, Type, Rating and Watched.",
      "An IMDb or TMDB ID column makes matching near-perfect.",
    ],
    fileHint: "my-library.csv",
  },
};

// The generic fallback keeps the grid rendering if the server ever returns a
// source this build has no presentation for.
export const DEFAULT_META: SourceMeta = SOURCE_META.generic;

export const metaFor = (id: string): SourceMeta => SOURCE_META[id as ImportSourceId] ?? DEFAULT_META;
