import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guards the app-wide fix for Android's "scrolls but won't tap" freeze
// (src/components/common/TapSafePressable.tsx).
//
// React Native's own Pressable measures a button when the finger goes down,
// and those measurements go stale for a screen that sat underneath while the
// keyboard resized the window — after which every tap on it is cancelled.
// The app uses gesture handler's Pressable everywhere instead, which can't
// go stale, and every Modal carries the gesture root that makes it work
// (common/GestureModal.tsx), since a Modal is its own native window.
//
// A new screen that imports either one from "react-native" would bring the
// bug back on that screen only, which is exactly the kind of thing nobody
// notices until a phone freezes. So this fails instead.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWED = ["src/components/common/TapSafePressable.tsx", "src/components/common/GestureModal.tsx"];

function screenFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") screenFiles(relative, found);
    } else if (entry.name.endsWith(".tsx")) {
      found.push(relative);
    }
  }
  return found;
}

const files = [...screenFiles("app"), ...screenFiles("src")].filter((file) => !ALLOWED.includes(file));

/** The names a file takes from "react-native" itself. */
function reactNativeImports(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"react-native";/g)) {
    for (const name of match[1].split(",")) {
      const clean = name.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (clean) names.push(clean);
    }
  }
  return names;
}

test("no screen imports Pressable from react-native", () => {
  const offenders = files.filter((file) => reactNativeImports(fs.readFileSync(path.join(root, file), "utf8")).includes("Pressable"));
  assert.deepEqual(
    offenders,
    [],
    `import Pressable from "src/components/common/TapSafePressable" instead — react-native's own goes deaf after the keyboard resizes the window`
  );
});

test("no screen imports Modal from react-native", () => {
  const offenders = files.filter((file) => reactNativeImports(fs.readFileSync(path.join(root, file), "utf8")).includes("Modal"));
  assert.deepEqual(
    offenders,
    [],
    `import Modal from "src/components/common/GestureModal" instead — a plain Modal has no gesture root, so nothing inside it responds`
  );
});

test("the app has screens to check in the first place", () => {
  assert.ok(files.length > 100, `only found ${files.length} screen files — has the layout changed?`);
});
