import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type LayoutChangeEvent,
} from "react-native";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

const DISMISS_FRACTION = 0.25;
const DISMISS_MIN_DISTANCE = 72;
const DISMISS_VELOCITY = 900;
const ASSUMED_SHEET_HEIGHT = 520;

/**
 * The sheet's side border. Content laid out from the screen width — a poster
 * grid — has to subtract it on both sides, or it comes out wider than the
 * sheet.
 */
export const SHEET_BORDER_WIDTH = 1;

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Android back button. Defaults to onClose; override it to close something
   * inside the sheet first (an inline sheet opened from this one).
   */
  onRequestClose?: () => void;
  /** Rendered in the drag area under the grabber; dragging it down dismisses the sheet. */
  header: ReactNode;
  children: ReactNode;
  /**
   * A fixed height, for content that fills the sheet (a grid). Without one
   * the sheet sizes to its content, up to 88% of the screen.
   */
  height?: DimensionValue;
  /**
   * Render into the current window instead of opening a new Modal — for a
   * sheet opened from inside another sheet. Pass it as that sheet's `overlay`
   * so it covers the whole window.
   */
  inline?: boolean;
  /** Rendered above this sheet, covering the whole window. */
  overlay?: ReactNode;
}

// The bottom sheet behind the collection filter menu and the public profile's
// list sheets: slides up over a dimmed backdrop, closes on a backdrop tap, the
// close button or a drag down on its header.
//
// The slide starts a frame after the sheet mounts, so mounting doesn't eat
// the animation's first frames. The drag feeds an Animated value through
// plain setValue calls, since handing a native-driver Animated.event to a
// gesture handler crashes on Fabric.
function SheetModal({ visible, onClose, onRequestClose, header, children, height, inline = false, overlay }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();

  const reveal = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(ASSUMED_SHEET_HEIGHT);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;
    let animation: Animated.CompositeAnimation | null = null;
    const frame = requestAnimationFrame(() => {
      animation = Animated.timing(reveal, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 180,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished && !visible) {
          setMounted(false);
          dragY.setValue(0);
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.stop();
    };
  }, [mounted, visible, reveal, dragY]);

  const onSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    setSheetHeight((current) => (measured > 0 && Math.abs(measured - current) > 1 ? measured : current));
  }, []);

  const onPanEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      const { translationY } = event.nativeEvent;
      dragY.setValue(translationY > 0 ? translationY : 0);
    },
    [dragY]
  );

  const onPanStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.oldState !== State.ACTIVE) return;
      const { translationY, velocityY } = event.nativeEvent;
      const threshold = Math.max(DISMISS_MIN_DISTANCE, sheetHeight * DISMISS_FRACTION);
      if (translationY > threshold || velocityY > DISMISS_VELOCITY) {
        Animated.timing(dragY, {
          toValue: sheetHeight,
          duration: 170,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) onClose();
        });
        return;
      }
      Animated.spring(dragY, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }).start();
    },
    [dragY, onClose, sheetHeight]
  );

  const { sheetTranslate, backdropOpacity } = useMemo(() => {
    const entrance = reveal.interpolate({ inputRange: [0, 1], outputRange: [screenHeight, 0] });
    return {
      sheetTranslate: Animated.add(entrance, dragY),
      backdropOpacity: Animated.multiply(
        reveal,
        dragY.interpolate({ inputRange: [0, sheetHeight], outputRange: [1, 0], extrapolate: "clamp" })
      ),
    };
  }, [reveal, dragY, screenHeight, sheetHeight]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, justifyContent: "flex-end" },
        dim: { backgroundColor: "rgba(0,0,0,0.55)" },
        sheet: {
          backgroundColor: colors.base100,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: SHEET_BORDER_WIDTH,
          borderBottomWidth: 0,
          borderColor: colors.border,
          overflow: "hidden",
        },
        sheetAuto: { maxHeight: "88%" },
        handle: { paddingTop: 10, paddingBottom: 4 },
        grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center" },
      }),
    [colors]
  );

  if (!mounted) return null;

  const content = (
    <View style={styles.backdrop}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, { opacity: backdropOpacity }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("Close")} />

      <Animated.View
        onLayout={onSheetLayout}
        style={[styles.sheet, height === undefined ? styles.sheetAuto : { height }, { transform: [{ translateY: sheetTranslate }] }]}
      >
        <PanGestureHandler onGestureEvent={onPanEvent} onHandlerStateChange={onPanStateChange}>
          <View>
            <View style={styles.handle} accessible={false}>
              <View style={styles.grabber} />
            </View>
            {header}
          </View>
        </PanGestureHandler>
        {children}
      </Animated.View>

      {overlay}
    </View>
  );

  if (inline) return <View style={StyleSheet.absoluteFill}>{content}</View>;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose ?? onClose} statusBarTranslucent>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>{content}</GestureHandlerRootView>
    </Modal>
  );
}

export default memo(SheetModal);

/** The title row with a close button that every collection sheet uses. */
export const SheetHeader = memo(function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
        title: { flex: 1, fontFamily: fonts.extrabold, fontSize: 19, color: colors.baseContent },
        close: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.base200,
        },
      }),
    [colors]
  );
  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable style={styles.close} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Close")}>
        <Ionicons name="close" size={18} color={colors.baseContent} />
      </Pressable>
    </View>
  );
});
