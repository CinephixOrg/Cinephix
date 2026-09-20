import { Pressable } from "react-native-gesture-handler";

// Every tappable thing in the app, so taps can't die.
//
// React Native's own Pressable decides whether a tap stayed on the button by
// measuring the button when the finger goes down. On Android (new
// architecture, native stacks) those measurements go stale for a screen that
// sat underneath while the window was resized — which is what the keyboard
// does, on any screen that opens one, including a pushed screen or a sheet
// over the one you came from. Afterwards every tap on the screen below is
// cancelled while scrolling (native) still works: the page reads as frozen,
// and never recovers. It hit Socials, then the Media feed, then Profile; the
// cause is the same each time, so the fix is app-wide rather than per screen.
// See react-navigation#12039, expo#30032, react-native#44643.
//
// Gesture handler's Pressable lets Android decide what was tapped instead of
// measuring, so it can't go stale. It takes the same props, and this is a
// plain re-export: `import Pressable from ".../common/TapSafePressable"`.
//
// It only works under a GestureHandlerRootView. The app root has one
// (app/_layout.tsx) and every Modal gets its own through common/GestureModal
// (a Modal is a separate native window and inherits neither). A new Modal
// must use GestureModal, or nothing inside it will respond —
// tapSafe.test.mts fails if a screen imports either one from react-native.
export default Pressable;
