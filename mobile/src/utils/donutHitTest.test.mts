import test from "node:test";
import assert from "node:assert/strict";
import { sliceAtPoint, type DonutArc, type DonutGeometry } from "./donutHitTest.ts";

// Drama is the first half of the ring (12 to 6 o'clock, clockwise, so the
// right side), Comedy the next quarter (bottom-left), Horror the last quarter
// (top-left).
const arcs: DonutArc[] = [
  { genre: "Drama", startFrac: 0, endFrac: 0.5 },
  { genre: "Comedy", startFrac: 0.5, endFrac: 0.75 },
  { genre: "Horror", startFrac: 0.75, endFrac: 1 },
];

const geometry = (rotation = 0): DonutGeometry => ({ cx: 100, cy: 100, innerRadius: 40, outerRadius: 60, rotation });

// A point on the ring at a clock angle (radians, 0 = 3 o'clock, clockwise positive).
const at = (angle: number, radius = 50) => [100 + radius * Math.cos(angle), 100 + radius * Math.sin(angle)] as const;

test("unrotated: each side of the ring picks the slice drawn there", () => {
  assert.equal(sliceAtPoint(...at(0), geometry(), arcs), "Drama"); // 3 o'clock
  assert.equal(sliceAtPoint(...at((3 * Math.PI) / 4), geometry(), arcs), "Comedy"); // bottom-left
  assert.equal(sliceAtPoint(...at((-3 * Math.PI) / 4), geometry(), arcs), "Horror"); // top-left
});

test("taps in the hole or outside the ring select nothing", () => {
  assert.equal(sliceAtPoint(100, 100, geometry(), arcs), null);
  assert.equal(sliceAtPoint(...at(0, 20), geometry(), arcs), null);
  assert.equal(sliceAtPoint(...at(0, 90), geometry(), arcs), null);
});

test("after the ring rotates, a tap picks the slice now under the finger", () => {
  // Rotated half a turn: Drama now covers the left side, Comedy the top-right.
  const rotated = geometry(Math.PI);
  assert.equal(sliceAtPoint(...at(Math.PI), rotated, arcs), "Drama");
  assert.equal(sliceAtPoint(...at(-Math.PI / 4), rotated, arcs), "Comedy");
  assert.equal(sliceAtPoint(...at(Math.PI / 4), rotated, arcs), "Horror");
});

test("rotation beyond a full turn, or negative, behaves the same", () => {
  assert.equal(sliceAtPoint(...at(Math.PI), geometry(Math.PI + 4 * Math.PI), arcs), "Drama");
  assert.equal(sliceAtPoint(...at(Math.PI), geometry(-Math.PI), arcs), "Drama");
});

test("slice boundaries belong to the slice that starts there", () => {
  // 6 o'clock is exactly where Drama ends and Comedy starts.
  assert.equal(sliceAtPoint(...at(Math.PI / 2 + 1e-9), geometry(), arcs), "Comedy");
  assert.equal(sliceAtPoint(...at(Math.PI / 2 - 1e-6), geometry(), arcs), "Drama");
});

test("a single slice owns the whole ring, and no slices means no hit", () => {
  const whole: DonutArc[] = [{ genre: "Drama", startFrac: 0, endFrac: 1 }];
  assert.equal(sliceAtPoint(...at(-Math.PI / 2), geometry(), whole), "Drama");
  assert.equal(sliceAtPoint(...at(0), geometry(), []), null);
});
