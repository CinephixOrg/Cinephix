import sharp from "sharp";

// Admin-triggered shareable "highlight" images (Madde 4.1 of the agreed
// community feature set) — a poll's current results, or a watch party's
// recap, rendered as a branded 1080x1920 (Instagram/TikTok Story ratio)
// PNG. Built as an SVG string (same declarative, gradient-text approach
// the mobile app's own Sync story/MatchTitleBadge use) and rasterized by
// sharp — a pure Node dependency, nothing mobile-side, so this works
// without any native rebuild. Mobile shares the resulting image's own URL
// via the OS text/link share sheet (no expo-sharing yet — see
// groupController.js's own comment on why not) rather than attaching the
// raw image bytes.

const WIDTH = 1080;
const HEIGHT = 1920;
const BG = "#0a0a10";
const DEFAULT_ACCENT = "#e6b84a";
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

async function posterDataUri(posterPath) {
  if (!posterPath) return null;
  try {
    const res = await fetch(`${POSTER_BASE}${posterPath}`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Shared chrome: a soft radial glow in the community's own accent color,
// the Cinephix wordmark, the community name as gradient text, and a
// closing CTA — every highlight image uses the same frame, only the
// middle (poll results vs. a watch party recap) differs.
function chrome({ communityName, accentColor }) {
  const accent = accentColor || DEFAULT_ACCENT;
  const header = `
    <defs>
      <radialGradient id="glow" cx="50%" cy="0%" r="65%">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.35" />
        <stop offset="1" stop-color="${accent}" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="nameGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${accent}" />
        <stop offset="0.5" stop-color="#ffffff" />
        <stop offset="1" stop-color="${accent}" />
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />
    <circle cx="${WIDTH / 2}" cy="0" r="${WIDTH * 0.65}" fill="url(#glow)" />
    <text x="${WIDTH / 2}" y="140" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="#ffffff" opacity="0.55">CINEPHIX</text>
    <text x="${WIDTH / 2}" y="230" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="800" fill="url(#nameGradient)">${escapeXml(communityName)}</text>
  `;
  const footer = `
    <text x="${WIDTH / 2}" y="${HEIGHT - 110}" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff">${escapeXml(
      "Cinephix'te katıl"
    )}</text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 60}" text-anchor="middle" font-family="sans-serif" font-size="26" fill="${accent}" font-weight="600">${escapeXml(
      communityName
    )}</text>
  `;
  return { header, footer, accent };
}

// Up to 5 options (the same cap createGroupPoll enforces) — each row is a
// small poster + title + a filled bar at its own live percentage.
export async function renderPollHighlight({ communityName, accentColor, options }) {
  const { header, footer, accent } = chrome({ communityName, accentColor });
  const total = options.reduce((sum, o) => sum + o.voteCount, 0);
  const rowHeight = 220;
  // Vertically centers the row block within the space between the
  // subtitle and the footer, rather than a fixed top anchor — a 2-option
  // poll and a 5-option poll both read as a deliberate layout instead of
  // the shorter one leaving a conspicuous empty gap below it.
  const rowsAreaTop = 400;
  const rowsAreaBottom = HEIGHT - 260;
  const rowsStartY = rowsAreaTop + Math.max(0, (rowsAreaBottom - rowsAreaTop - options.length * rowHeight) / 2);
  const posterUris = await Promise.all(options.map((o) => posterDataUri(o.posterUrl)));

  const rows = options
    .map((option, i) => {
      const y = rowsStartY + i * rowHeight;
      const pct = total > 0 ? Math.round((option.voteCount / total) * 100) : 0;
      const barWidth = Math.round((WIDTH - 480) * (pct / 100));
      const posterUri = posterUris[i];
      return `
        ${posterUri ? `<image x="140" y="${y}" width="110" height="165" href="${posterUri}" preserveAspectRatio="xMidYMid slice" />` : ""}
        <text x="280" y="${y + 50}" font-family="sans-serif" font-size="34" font-weight="700" fill="#ffffff">${escapeXml(option.text)}</text>
        <rect x="280" y="${y + 80}" width="${WIDTH - 420}" height="20" rx="10" fill="#ffffff" opacity="0.12" />
        <rect x="280" y="${y + 80}" width="${Math.max(10, barWidth)}" height="20" rx="10" fill="${accent}" />
        <text x="280" y="${y + 140}" font-family="sans-serif" font-size="30" font-weight="800" fill="${accent}">${pct}%</text>
      `;
    })
    .join("");

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    ${header}
    <text x="${WIDTH / 2}" y="340" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#ffffff" opacity="0.7">${escapeXml(
      "Topluluk anketi · " + total + " oy"
    )}</text>
    ${rows}
    ${footer}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderWatchPartyHighlight({ communityName, accentColor, contentTitle, contentPosterUrl, attendeeCount, scheduledAt }) {
  const { header, footer } = chrome({ communityName, accentColor });
  const posterUri = await posterDataUri(contentPosterUrl);
  const posterW = 460;
  const posterH = 690;
  const posterX = (WIDTH - posterW) / 2;
  const posterY = 420;
  const dateLabel = new Date(scheduledAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    ${header}
    ${
      posterUri
        ? `<image x="${posterX}" y="${posterY}" width="${posterW}" height="${posterH}" href="${posterUri}" preserveAspectRatio="xMidYMid slice" />`
        : ""
    }
    <text x="${WIDTH / 2}" y="${posterY + posterH + 90}" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="800" fill="#ffffff">${escapeXml(
      contentTitle
    )}</text>
    <text x="${WIDTH / 2}" y="${posterY + posterH + 150}" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#ffffff" opacity="0.7">${escapeXml(
      `${dateLabel} · ${attendeeCount} kişi katıldı`
    )}</text>
    ${footer}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
