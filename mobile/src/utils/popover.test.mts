import test from "node:test";
import assert from "node:assert/strict";
import { placePopover } from "./popover.ts";

const SCREEN = 390;

test("a button on the left opens a menu that grows rightwards from its left edge", () => {
  const placement = placePopover({ x: 16, y: 50, width: 36, height: 36 }, SCREEN, 260);
  assert.equal(placement.align, "left");
  assert.equal(placement.left, 12, "kept off the screen edge");
  assert.equal(placement.top, 94, "just below the button");
  assert.equal(placement.caretX, 22, "caret points at the button's centre");
});

test("a button on the right opens a menu lined up with its right edge", () => {
  const placement = placePopover({ x: 340, y: 50, width: 36, height: 36 }, SCREEN, 260);
  assert.equal(placement.align, "right");
  assert.equal(placement.left, SCREEN - 12 - 260);
  assert.ok(placement.caretX > 200 && placement.caretX <= 260 - 18);
});

test("a menu wider than the screen shrinks to fit inside the margins", () => {
  const placement = placePopover({ x: 10, y: 0, width: 20, height: 20 }, 300, 400);
  assert.equal(placement.left, 12);
  assert.ok(placement.caretX >= 18);
});
