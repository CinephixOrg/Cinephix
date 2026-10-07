#!/usr/bin/env node
// Builds the app's launcher, adaptive, monochrome, splash and favicon images
// from the Cinephix logo (the same file the home screen header shows).
//
//   icon.png                     1024², opaque: the logo on the brand green,
//                                ~15% padding on each side
//   android-icon-foreground.png  1024², transparent: the logo sized so that its
//                                whole bounding box sits inside the 66% safe
//                                circle, so no launcher mask can crop it
//   android-icon-monochrome.png  1024², the logo's white face as a white
//                                silhouette, same placement (Android 13+ themed icons)
//   splash-icon.png              the logo alone on transparency
//   favicon.png                  48², the launcher icon scaled down
//
// The adaptive icon's background is a plain colour (android.adaptiveIcon.
// backgroundColor in app.json, keep it equal to --background), not an image.
// The splash keeps the app's dark background (expo-splash-screen's
// backgroundColor), where only the logo itself is drawn. The notification icon has its
// own script: npm run notification-icon.
//
// Usage, from mobile/:
//   npm run app-icons
//   npm run app-icons -- --preview /tmp/icons.png
//
// Uses sharp, which the backend workspace already installs (hoisted to the
// repo's node_modules). After changing the icons, make a new native build.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const MOBILE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const asset = (name) => path.join(MOBILE_ROOT, "assets", name);

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const next = argv[i + 1];
    options[argv[i].slice(2)] = next !== undefined && !next.startsWith("--") ? argv[++i] : "true";
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const SOURCE = options.source ? path.resolve(options.source) : asset("cinephix_logo.png");
// The brand green: the logo's dark extrusion disappears on the app's #171212.
const BACKGROUND = options.background ?? "#1eb854";
const SPLASH_BACKGROUND = "#171212";
const SIZE = 1024;
const ICON_PADDING = 0.15; // of the side, each side
const SAFE_CIRCLE = 0.66; // adaptive icon: the part every launcher mask keeps
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** The logo trimmed to its visible pixels. */
async function trimmedLogo() {
  return sharp(SOURCE).ensureAlpha().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
}

/** The logo scaled to fit `box`×`box` (aspect kept), centred on a `SIZE`² canvas. */
async function placed(logo, box, background) {
  const scaled = await sharp(logo.data)
    .resize(box, box, { fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((SIZE - scaled.info.width) / 2);
  const top = Math.round((SIZE - scaled.info.height) / 2);
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background } })
    .composite([{ input: scaled.data, left, top }])
    .png();
}

/** The light face of the logo as white on transparency (its dark extrusion and outline drop out). */
async function whiteFace(imagePng) {
  const { data, info } = await sharp(imagePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const luma = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    const coverage = Math.min(1, Math.max(0, ((data[i + 3] / 255) * luma - 0.35) / 0.3));
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = Math.round(coverage * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

const logo = await trimmedLogo();
const { width: w, height: h } = logo.info;

// Launcher icon: opaque, logo inside the padded square.
const iconBox = Math.round(SIZE * (1 - 2 * ICON_PADDING));
const icon = await (await placed(logo, iconBox, BACKGROUND)).flatten({ background: BACKGROUND }).toBuffer();
await sharp(icon).removeAlpha().png().toFile(asset("icon.png"));

// Adaptive foreground: the bounding box's diagonal fits the safe circle.
const diagonal = Math.hypot(w, h);
const scale = (SIZE * SAFE_CIRCLE) / diagonal;
const foregroundBox = Math.floor(Math.max(w, h) * scale);
const foreground = await (await placed(logo, foregroundBox, TRANSPARENT)).toBuffer();
await sharp(foreground).toFile(asset("android-icon-foreground.png"));

// Monochrome (themed icons): the white face, same placement as the foreground.
await (await whiteFace(foreground)).toFile(asset("android-icon-monochrome.png"));

// Splash: just the logo; expo-splash-screen centres it on the background colour.
await sharp(logo.data).resize(SIZE, SIZE, { fit: "inside" }).png().toFile(asset("splash-icon.png"));

// Web favicon.
await sharp(icon).resize(48, 48, { kernel: "lanczos3" }).png().toFile(asset("favicon.png"));

console.log(`Icons written from ${path.relative(MOBILE_ROOT, SOURCE)} (logo ${w}×${h}), background ${BACKGROUND}.`);

if (options.preview) {
  await writePreview(options.preview, { icon, foreground });
  console.log(`Preview: ${options.preview}`);
}

// A contact sheet for checking by eye: the launcher icon, the adaptive icon
// under circle / squircle / rounded-square masks, a themed (monochrome) icon,
// the notification icon at 1x and 6x, the splash, and the favicon.
async function writePreview(file, { icon, foreground }) {
  const T = 256;
  const tile = (buffer) => sharp(buffer).resize(T, T).png().toBuffer();
  const mask = (svgShape) => Buffer.from(`<svg width="${T}" height="${T}">${svgShape}</svg>`);
  const masks = {
    circle: mask(`<circle cx="${T / 2}" cy="${T / 2}" r="${T / 2}"/>`),
    squircle: mask(`<rect width="${T}" height="${T}" rx="${T * 0.3}"/>`),
    rounded: mask(`<rect width="${T}" height="${T}" rx="${T * 0.12}"/>`),
  };
  // Launchers show the middle 72dp of the 108dp adaptive layers.
  const crop = Math.round(SIZE * (18 / 108));
  // (sharp crops and resizes before compositing, so the layers are flattened first.)
  const layers = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: BACKGROUND } })
    .composite([{ input: foreground }])
    .png()
    .toBuffer();
  const adaptive = await sharp(layers)
    .extract({ left: crop, top: crop, width: SIZE - 2 * crop, height: SIZE - 2 * crop })
    .resize(T, T)
    .png()
    .toBuffer();
  const masked = (shape) => sharp(adaptive).composite([{ input: masks[shape], blend: "dest-in" }]).png().toBuffer();
  const themedLayer = await sharp(asset("android-icon-monochrome.png"))
    .extract({ left: crop, top: crop, width: SIZE - 2 * crop, height: SIZE - 2 * crop })
    .resize(T, T)
    .toBuffer();
  const themed = await sharp({ create: { width: T, height: T, channels: 4, background: "#d7e8cd" } })
    .composite([
      { input: await sharp(themedLayer).linear([0, 0, 0, 1], [0x1f, 0x3a, 0x10, 0]).png().toBuffer() },
      { input: masks.circle, blend: "dest-in" },
    ])
    .png()
    .toBuffer();
  const notification = asset("notification-icon.png");
  const tiles = [
    await tile(icon),
    await masked("circle"),
    await masked("squircle"),
    await masked("rounded"),
    themed,
    await sharp(notification).resize(T, T, { kernel: "nearest" }).png().toBuffer(),
    await sharp({ create: { width: T, height: T, channels: 4, background: SPLASH_BACKGROUND } })
      .composite([{ input: await sharp(asset("splash-icon.png")).resize(Math.round(T * 0.4), Math.round(T * 0.4), { fit: "inside" }).toBuffer(), gravity: "center" }])
      .png()
      .toBuffer(),
    await sharp(asset("favicon.png")).resize(T, T, { kernel: "nearest" }).png().toBuffer(),
  ];
  const gap = 16;
  await sharp({ create: { width: 4 * T + 5 * gap, height: 2 * T + 3 * gap, channels: 4, background: "#5a5a5a" } })
    .composite(tiles.map((input, i) => ({ input, left: gap + (i % 4) * (T + gap), top: gap + Math.floor(i / 4) * (T + gap) })))
    .png()
    .toFile(file);
}
