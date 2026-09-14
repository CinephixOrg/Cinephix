// Which donut slice a tap landed on.
//
// Pure and React-free so it runs under `node --test` (donutHitTest.test.mts).
//
// CineGraphDonut draws every slice as a full circle that only shows its own
// arc through a stroke dash, inside a group that rotates to line the selected
// slice up with its chip. react-native-svg's own touch handling hit-tests the
// whole circle and ignores that rotation, so tapping a slice selected
// whichever slice happened to be on top, or the one that sat under the finger
// before the ring rotated. Deciding from the geometry here gets both right.

const TAU = Math.PI * 2;

export interface DonutArc {
  genre: string;
  /** Fraction of the circle where the slice starts, clockwise from 12 o'clock. */
  startFrac: number;
  endFrac: number;
}

export interface DonutGeometry {
  cx: number;
  cy: number;
  /** Taps closer to the center than this are not on the ring. */
  innerRadius: number;
  /** Taps farther out than this are not on the ring. */
  outerRadius: number;
  /** The ring's current rotation in radians, clockwise positive (screen coordinates). */
  rotation: number;
}

export function sliceAtPoint(x: number, y: number, geometry: DonutGeometry, arcs: readonly DonutArc[]): string | null {
  if (arcs.length === 0) return null;
  const dx = x - geometry.cx;
  const dy = y - geometry.cy;
  const distance = Math.hypot(dx, dy);
  if (distance < geometry.innerRadius || distance > geometry.outerRadius) return null;

  // Undo the ring's rotation, then measure clockwise from 12 o'clock, where
  // the first slice begins.
  const angle = Math.atan2(dy, dx) - geometry.rotation + Math.PI / 2;
  const frac = (((angle % TAU) + TAU) % TAU) / TAU;

  for (const arc of arcs) {
    if (frac >= arc.startFrac && frac < arc.endFrac) return arc.genre;
  }
  // Only reachable through floating-point rounding right at 12 o'clock.
  return arcs[arcs.length - 1].genre;
}
