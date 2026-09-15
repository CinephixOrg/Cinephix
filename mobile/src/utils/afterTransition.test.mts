import test from "node:test";
import assert from "node:assert/strict";
import { afterTransition, type TransitionSource } from "./afterTransition.ts";

function fakeScreen() {
  let listener: ((event: { data?: { closing?: boolean } }) => void) | null = null;
  const source: TransitionSource = {
    addListener(_type, next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  return {
    source,
    emit: (closing: boolean) => listener?.({ data: { closing } }),
    get listening() {
      return listener !== null;
    },
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("runs once the screen has been covered, and stops listening", () => {
  const screen = fakeScreen();
  let runs = 0;
  afterTransition(screen.source, () => runs++, 10_000);
  assert.equal(runs, 0);
  screen.emit(true);
  assert.equal(runs, 1);
  assert.equal(screen.listening, false);
});

test("this screen's own opening animation ending doesn't count", () => {
  const screen = fakeScreen();
  let runs = 0;
  afterTransition(screen.source, () => runs++, 10_000);
  screen.emit(false);
  assert.equal(runs, 0);
  screen.emit(true);
  assert.equal(runs, 1);
});

test("without the event, the fallback still runs it", async () => {
  const screen = fakeScreen();
  let runs = 0;
  afterTransition(screen.source, () => runs++, 5);
  await wait(20);
  assert.equal(runs, 1);
  assert.equal(screen.listening, false);
});

test("never runs twice, whichever comes first", async () => {
  const screen = fakeScreen();
  let runs = 0;
  afterTransition(screen.source, () => runs++, 5);
  screen.emit(true);
  await wait(20);
  screen.emit(true);
  assert.equal(runs, 1);
});
