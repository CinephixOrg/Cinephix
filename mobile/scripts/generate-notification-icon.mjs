#!/usr/bin/env node
// Builds Android's status-bar notification icon from a logo.
//
// Android draws a notification's small icon from its alpha channel alone and
// paints every visible pixel in one colour. Given the full-colour app icon,
// every opaque pixel lights up, background included, and the icon becomes a
// solid white square. The icon has to be a white shape on transparency.
//
// This script makes that mask from any logo PNG, choosing what counts as the
// shape with --mode:
//   silhouette  the logo's own transparency (a logo on a transparent background)
//   dark        dark parts of the logo (dark artwork on a light background)
//   light       light parts of the logo (light artwork on a dark background)
//   auto        silhouette when the source has transparency; otherwise dark
//               or light, by the colour of its corners (the default)
// It then trims the shape, fits it inside Android's 2dp safe margin, and
// area-averages it down so the edges stay smooth at 24dp.
//
// Usage, from mobile/:
//   npm run notification-icon
//   npm run notification-icon -- --source ./assets/cat-logo.png --mode dark --preview /tmp/icon-preview.png
//
// Options:
//   --source     logo PNG                  (default ./assets/cinephix_logo.png)
//   --out        output PNG                (default ./assets/notification-icon.png)
//   --size       output size in px         (default 96: 24dp at xxxhdpi)
//   --padding    margin in px on each side (default 8: 2dp at xxxhdpi)
//   --mode       silhouette | dark | light | auto (default auto)
//   --threshold  0..1, where a pixel starts counting as shape (default 0.5)
//   --preview    also write a 6x enlargement on a dark background, for checking by eye
//
// After changing the icon, rebuild the native app (npx expo prebuild --clean,
// or a new EAS build): the icon is compiled into the Android resources.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";

const { PNG } = pngjs;
const MOBILE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    options[argv[i].slice(2)] = next !== undefined && !next.startsWith("--") ? argv[++i] : "true";
  }
  return options;
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const fromRoot = (file) => (path.isAbsolute(file) ? file : path.resolve(MOBILE_ROOT, file));

function resolveMode(png, requested) {
  if (requested !== "auto") return requested;
  const { width, height, data } = png;
  let translucent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) translucent++;
  if (translucent / (width * height) > 0.01) return "silhouette";
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const background = corners.reduce((sum, p) => sum + luma(data, p * 4), 0) / corners.length;
  return background > 0.5 ? "dark" : "light";
}

function luma(data, offset) {
  return (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) / 255;
}

// How much of each source pixel belongs to the shape, 0..1. A soft threshold
// turns faint tones (anti-aliasing, paper texture, a light grey background)
// into clean edges instead of a haze across the whole icon.
function coverage(png, mode, threshold) {
  const { width, height, data } = png;
  const out = new Float32Array(width * height);
  const low = threshold - 0.15;
  for (let p = 0; p < out.length; p++) {
    const o = p * 4;
    const alpha = data[o + 3] / 255;
    const raw = mode === "silhouette" ? alpha : mode === "dark" ? alpha * (1 - luma(data, o)) : alpha * luma(data, o);
    out[p] = clamp01((raw - low) / 0.3);
  }
  return out;
}

function boundingBox(values, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (values[y * width + x] <= 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// Summed-area table: the sum over any rectangle, fractional edges included,
// in constant time, which makes an exact area-average downscale cheap.
function summedAreaTable(values, width, height) {
  const table = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += values[(y - 1) * width + (x - 1)];
      table[y * (width + 1) + x] = table[(y - 1) * (width + 1) + x] + row;
    }
  }
  const at = (x, y) => table[y * (width + 1) + x];
  // The table is bilinear inside each cell, so interpolating it is exact.
  const sumTo = (x, y) => {
    const xi = Math.min(Math.floor(x), width - 1), yi = Math.min(Math.floor(y), height - 1);
    const fx = x - xi, fy = y - yi;
    const top = at(xi, yi) * (1 - fx) + at(xi + 1, yi) * fx;
    const bottom = at(xi, yi + 1) * (1 - fx) + at(xi + 1, yi + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  return (x0, y0, x1, y1) => sumTo(x1, y1) - sumTo(x0, y1) - sumTo(x1, y0) + sumTo(x0, y0);
}

function renderMask(values, width, height, box, size, padding) {
  const inner = size - 2 * padding;
  const scale = inner / Math.max(box.x1 - box.x0, box.y1 - box.y0);
  const offsetX = (size - (box.x1 - box.x0) * scale) / 2;
  const offsetY = (size - (box.y1 - box.y0) * scale) / 2;
  const sum = summedAreaTable(values, width, height);
  const pixelArea = 1 / (scale * scale);

  const icon = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx0 = Math.max(box.x0, (x - offsetX) / scale + box.x0);
      const sx1 = Math.min(box.x1, (x + 1 - offsetX) / scale + box.x0);
      const sy0 = Math.max(box.y0, (y - offsetY) / scale + box.y0);
      const sy1 = Math.min(box.y1, (y + 1 - offsetY) / scale + box.y0);
      const value = sx1 > sx0 && sy1 > sy0 ? sum(sx0, sy0, sx1, sy1) / pixelArea : 0;
      const o = (y * size + x) * 4;
      icon.data[o] = icon.data[o + 1] = icon.data[o + 2] = 255;
      icon.data[o + 3] = Math.round(clamp01(value) * 255);
    }
  }
  return icon;
}

function writePreview(icon, file) {
  const factor = 6;
  const size = icon.width * factor;
  const preview = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = icon.data[(Math.floor(y / factor) * icon.width + Math.floor(x / factor)) * 4 + 3] / 255;
      const o = (y * size + x) * 4;
      // White over the dark grey of a status bar.
      const value = Math.round(32 + (255 - 32) * alpha);
      preview.data[o] = preview.data[o + 1] = preview.data[o + 2] = value;
      preview.data[o + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(preview));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const source = fromRoot(options.source ?? "./assets/cinephix_logo.png");
  const out = fromRoot(options.out ?? "./assets/notification-icon.png");
  const size = Number(options.size ?? 96);
  const padding = Number(options.padding ?? 8);
  const threshold = Number(options.threshold ?? 0.5);
  const requestedMode = options.mode ?? "auto";

  if (!["auto", "silhouette", "dark", "light"].includes(requestedMode)) throw new Error(`Unknown --mode ${requestedMode}`);
  if (!Number.isInteger(size) || size < 24) throw new Error("--size must be a whole number of at least 24");
  if (!(padding >= 0 && padding * 2 < size)) throw new Error("--padding must leave room for the icon");
  if (!(threshold > 0 && threshold < 1)) throw new Error("--threshold must be between 0 and 1");

  const png = PNG.sync.read(fs.readFileSync(source));
  const mode = resolveMode(png, requestedMode);
  const values = coverage(png, mode, threshold);
  const box = boundingBox(values, png.width, png.height);
  if (!box) throw new Error(`Nothing in ${path.basename(source)} counts as shape in "${mode}" mode. Try another --mode or --threshold.`);

  const icon = renderMask(values, png.width, png.height, box, size, padding);
  fs.writeFileSync(out, PNG.sync.write(icon));
  if (options.preview) writePreview(icon, fromRoot(options.preview));

  let solid = 0;
  for (let i = 3; i < icon.data.length; i += 4) if (icon.data[i] > 127) solid++;
  const filled = solid / (size * size);
  console.log(`${path.relative(MOBILE_ROOT, out)}: ${size}x${size}, "${mode}" mode, ${Math.round(filled * 100)}% of the icon filled.`);
  if (filled > 0.6) {
    console.warn("Warning: the shape fills most of the icon, so it will read as a solid block in the status bar. Try --mode dark or light.");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
