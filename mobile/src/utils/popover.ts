// Where a dropdown menu sits relative to the button that opened it.
//
// Pure so it runs under `node --test` (popover.test.mts).

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverPlacement {
  top: number;
  /** Distance from the screen's left edge to the menu's left edge. */
  left: number;
  /** Which edge the menu grows from — also where its scale animation starts. */
  align: "left" | "right";
  /** The caret's centre, measured from the menu's own left edge. */
  caretX: number;
}

const GAP = 8;
const EDGE = 12;
const CARET_INSET = 18;

/**
 * Below the button, lined up with whichever of its edges is nearer the
 * screen's edge, and kept on screen. A button in the left half opens a menu
 * that grows rightwards from its left edge, and vice versa.
 */
export function placePopover(anchor: AnchorRect, screenWidth: number, menuWidth: number): PopoverPlacement {
  const width = Math.min(menuWidth, screenWidth - EDGE * 2);
  const anchorCentre = anchor.x + anchor.width / 2;
  const align = anchorCentre <= screenWidth / 2 ? "left" : "right";
  const preferredLeft = align === "left" ? anchor.x - 4 : anchor.x + anchor.width + 4 - width;
  const left = Math.min(Math.max(preferredLeft, EDGE), screenWidth - EDGE - width);
  const caretX = Math.min(Math.max(anchorCentre - left, CARET_INSET), width - CARET_INSET);
  return { top: anchor.y + anchor.height + GAP, left, align, caretX };
}
