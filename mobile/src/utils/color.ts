// Relative luminance per WCAG 2.1, used to choose a readable foreground.
function luminance(hex: string): number {
  const value = hex.replace("#", "");
  if (value.length !== 6) return 0;
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The first of `candidates` that stands out on `background` — 3:1, the WCAG
 * bar for icons — else `fallback`. For a colour that has to mean something
 * (a read receipt's blue) on whatever a theme puts underneath it.
 */
export function firstVisibleOn(background: string, candidates: string[], fallback: string): string {
  return candidates.find((color) => contrast(color, background) >= 3) ?? fallback;
}

/**
 * Black or white, whichever reads better on `background`.
 *
 * The palettes define `primaryContent` for the primary colour but have no
 * equivalent for `error`, and hardcoding white fails contrast on five of the
 * nine themes — their errors are pale corals, not deep reds. Picking by
 * measured contrast keeps a solid destructive button legible on all of them.
 */
export function readableOn(background: string): string {
  return contrast(background, "#000000") >= contrast(background, "#ffffff") ? "#000000" : "#ffffff";
}
