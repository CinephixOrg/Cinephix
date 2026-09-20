import { Modal, type ModalProps } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// A React Native Modal that gesture handler works inside.
//
// A Modal is its own native window, so it doesn't inherit the root
// GestureHandlerRootView from app/_layout.tsx. Without one of its own,
// nothing in it that uses gesture handler responds: not a nested scroller,
// and not TapSafePressable — which every tappable thing in the app now is
// (see common/TapSafePressable.tsx). So every Modal gets a root here rather
// than each one remembering to add its own.
//
// Drop-in for `Modal`: same props, same children.
export default function GestureModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
    </Modal>
  );
}
