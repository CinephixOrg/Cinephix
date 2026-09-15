import { useEffect, useState, type ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { Drawer } from "react-native-drawer-layout";

// Longer than the drawer's close spring, so the hiding below never cuts it short.
const CLOSE_SETTLE_MS = 500;
const HIDDEN_PANEL: ViewStyle = { display: "none" };
const HIDDEN_OVERLAY: ViewStyle = { opacity: 0 };

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  renderDrawerContent: () => ReactNode;
  children: ReactNode;
}

// The profile's right-hand slide-out drawer, shared by the own profile and the
// public profile so both behave identically.
//
// The drawer keeps its panel and its dimming overlay out of sight only through
// Reanimated animated styles: a transform for the panel, opacity for the
// overlay. Their plain styles are "panel in view" and "overlay at 50% black".
// When a screen holding the drawer is pushed or popped, the navigation
// transition re-commits the view tree, and on the new architecture that
// commit can put those plain styles back for the length of the animation: the
// dark overlay and the panel flashed over the page for about half a second
// on every exit from a public profile page.
//
// So once the drawer has fully closed, its plain styles hide both as well, and
// no re-commit can reveal them. Opening, closing and swiping are unchanged:
// while the drawer is open or moving, the animated styles are in charge (they
// set display and opacity themselves, so an edge swipe still brings the panel
// in).
export default function ProfileDrawer({ open, onOpen, onClose, renderDrawerContent, children }: Props) {
  const [settledClosed, setSettledClosed] = useState(!open);

  useEffect(() => {
    if (open) {
      setSettledClosed(false);
      return;
    }
    const timer = setTimeout(() => setSettledClosed(true), CLOSE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Drawer
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      drawerPosition="right"
      renderDrawerContent={renderDrawerContent}
      drawerStyle={settledClosed ? HIDDEN_PANEL : undefined}
      overlayStyle={settledClosed ? HIDDEN_OVERLAY : undefined}
    >
      {children}
    </Drawer>
  );
}
