import { useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const SPRING_FRICTION = 7;

export interface PhotoViewerAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  // Filled/primary-colored circle instead of the neutral default — e.g.
  // the Follow action once you're already following.
  active?: boolean;
  loading?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  imageUri?: string | null;
  fallbackText: string;
  // Omit (or pass []) for a plain viewer with no action row — own profile
  // has nothing useful to put here yet; Public Profile passes Follow +
  // Share Profile.
  actions?: PhotoViewerAction[];
}

// Instagram/WhatsApp-style "tap the avatar to see it big" viewer. Deliberately
// generic — no own-vs-public-profile knowledge lives here at all — so both
// ProfileHeaderInstagram call sites (own and public profile share this one
// header component already) can reuse it verbatim, just passing a different
// `actions` array. Pinch-zoom scales the whole circular photo as one rigid
// unit around its own center (no panning, no cropped viewport onto a larger
// image) — "zoom in" just means "the same circle, bigger," matching the
// explicit request that you can't navigate around inside the image.
export default function ProfilePhotoViewerModal({ visible, onClose, imageUri, fallbackText, actions }: Props) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const photoSize = Math.min(280, screenWidth * 0.72);

  // A "look closer while held" magnifier, not a persistent zoom: scale
  // tracks the pinch live (native-driven, no react-native-reanimated
  // needed), and the moment the gesture ends — for any reason, not just a
  // clean release — it springs straight back to 1. Nothing is ever
  // "committed," so there's no stuck-zoomed state to reset elsewhere.
  const scale = useRef(new Animated.Value(1)).current;

  // A plain callback, not Animated.event: with useNativeDriver that returns
  // an AnimatedEvent *object*, which only Animated components know how to
  // attach. Passing it to a gesture handler's onGestureEvent makes Fabric
  // throw "Expected onGestureHandlerEvent listener to be a function,
  // instead got a value of object type" the moment a pinch begins.
  // setValue still writes through to the native node, so the magnifier
  // stays native-driven.
  const onPinchEvent = (event: PinchGestureHandlerGestureEvent) => {
    scale.setValue(event.nativeEvent.scale);
  };

  const onPinchStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(scale, { toValue: 1, friction: SPRING_FRICTION, useNativeDriver: true }).start();
    }
  };

  const handleClose = () => {
    scale.setValue(1);
    onClose();
  };

  // Every action (Follow, Share Profile, ...) closes the viewer once
  // pressed — mainly so Share Profile's own recipient-picker modal never
  // ends up stacked on top of this one (two simultaneous <Modal>s is what
  // was silently swallowing the "Shared" toast: it renders in the app's
  // normal view tree, which sits *under* any still-open native Modal).
  const handleActionPress = (action: PhotoViewerAction) => {
    handleClose();
    action.onPress();
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Fixed dark backdrop rather than a theme token — every media
        // viewer this app's users already know (Instagram/WhatsApp/iOS
        // Photos) goes near-black regardless of system light/dark mode,
        // since it's what makes the photo itself read as the focus.
        overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", alignItems: "center", justifyContent: "center" },
        photo: { width: photoSize, height: photoSize, borderRadius: photoSize / 2 },
        photoFallback: { backgroundColor: colors.base300, alignItems: "center", justifyContent: "center" },
        photoFallbackText: { fontFamily: fonts.bold, fontSize: photoSize * 0.28, color: colors.primary },
        actionsRow: {
          position: "absolute",
          bottom: 56,
          flexDirection: "row",
          gap: 28,
        },
        actionItem: { alignItems: "center" },
        actionIconCircle: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "rgba(255,255,255,0.15)",
          alignItems: "center",
          justifyContent: "center",
        },
        actionIconCircleActive: { backgroundColor: colors.primary },
        actionLabel: { fontFamily: fonts.medium, fontSize: 12, color: "#fff", marginTop: 8 },
      }),
    [colors, photoSize]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* RN's Modal renders into its own detached native root, outside the
          app's own GestureHandlerRootView (set up once in app/_layout.tsx)
          — without a second one here, react-native-gesture-handler
          recognizes no gestures at all inside a Modal, which is why pinch
          previously did nothing. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Tapping anywhere counts as "outside the photo" and closes it —
            the photo itself (below) sits in its own Pressable with a no-op
            press so a tap there doesn't fall through to this one. Action
            buttons already claim their own taps as Pressables, so they
            don't trigger this either. */}
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable onPress={() => {}}>
            <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
              <Animated.View style={{ transform: [{ scale }] }}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoFallback]}>
                    <Text style={styles.photoFallbackText}>{fallbackText}</Text>
                  </View>
                )}
              </Animated.View>
            </PinchGestureHandler>
          </Pressable>

          {actions && actions.length > 0 && (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
                <Pressable
                  key={action.key}
                  style={styles.actionItem}
                  onPress={() => handleActionPress(action)}
                  disabled={action.loading}
                >
                  <View style={[styles.actionIconCircle, action.active && styles.actionIconCircleActive]}>
                    {action.loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name={action.icon} size={22} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
