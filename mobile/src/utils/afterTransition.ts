// Runs work once a push has finished covering the current screen.
//
// The native stack tells the covered screen with a `transitionEnd` event
// marked `closing` — the new screen is fully in and this one is out of sight.
// If that event doesn't come (the push didn't happen, or the platform skipped
// it), the fallback runs the work anyway, so it's delayed, never lost.
//
// Pure (no React Native) so it runs under `node --test` (afterTransition.test.mts).

type TransitionEvent = { data?: { closing?: boolean } };

export interface TransitionSource {
  addListener(type: "transitionEnd", listener: (event: TransitionEvent) => void): () => void;
}

/** Longer than a stack push (~350ms on iOS, ~450ms on Android), short enough not to be noticed. */
export const TRANSITION_FALLBACK_MS = 700;

export function afterTransition(source: TransitionSource, task: () => void, fallbackMs = TRANSITION_FALLBACK_MS): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    unsubscribe();
    task();
  };
  const timer = setTimeout(run, fallbackMs);
  // The same event marks this screen's own opening animation ending
  // (closing: false); only being covered counts.
  const unsubscribe = source.addListener("transitionEnd", (event) => {
    if (event?.data?.closing) run();
  });
}
