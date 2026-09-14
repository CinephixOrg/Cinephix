import { memo, useCallback, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { readableOn } from "../../utils/color";
import { localeUpper } from "../../utils/text";
import { copyFor, relativeTime } from "../../utils/notificationFeed";
import type { Notification, NotificationType } from "../../types";

// A swipe past this share of the row's width, or a flick faster than this,
// deletes; anything less springs back.
const SWIPE_DISMISS_FRACTION = 0.35;
const SWIPE_DISMISS_VELOCITY = 900;
const AVATAR = 46;

type Colors = ReturnType<typeof useTheme>["colors"];
type Tone = "primary" | "info" | "error";

// The icon on the avatar's corner and its colour.
const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
  follow: { icon: "person-add", tone: "primary" },
  message: { icon: "chatbubble", tone: "info" },
  share_like: { icon: "heart", tone: "error" },
};
const FALLBACK_META = { icon: "notifications" as const, tone: "primary" as Tone };

function createStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { marginHorizontal: 16, marginBottom: 8 },
    deleteBackground: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
      backgroundColor: colors.error,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: 24,
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.base100,
    },
    cardUnread: { backgroundColor: colors.base200, borderColor: `${colors.primary}40` },
    pressable: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 16 },
    pressed: { opacity: 0.75 },
    avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, backgroundColor: colors.base300 },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    avatarInitials: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
    badge: {
      position: "absolute",
      right: -3,
      bottom: -3,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, paddingTop: 2 },
    text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.baseContent },
    emphasis: { fontFamily: fonts.bold },
    // A message's own words, set apart from the sentence about it.
    preview: {
      marginTop: 6,
      alignSelf: "flex-start",
      maxWidth: "100%",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: colors.base300,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.baseContent,
    },
    time: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder, marginTop: 4 },
    unreadDot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: colors.primary },
    header: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  });
}

type Styles = ReturnType<typeof createStyles>;

// One StyleSheet per theme, shared by every row, instead of one per row.
const stylesByTheme = new WeakMap<Colors, Styles>();
function useRowStyles(colors: Colors): Styles {
  let styles = stylesByTheme.get(colors);
  if (!styles) {
    styles = createStyles(colors);
    stylesByTheme.set(colors, styles);
  }
  return styles;
}

interface Props {
  item: Notification;
  /** The page's clock, so every row's "5m" updates together. */
  now: Date;
  onOpen: (item: Notification) => void;
  onDelete: (item: Notification) => void;
}

// One notification.
//
// Swipe left to delete: the card follows the finger over a red delete panel,
// and past the threshold it slides the rest of the way out as a native
// animation before the list removes it — the rows below then glide up
// (LayoutAnimation, in the screen). The drag feeds its value with plain
// setValue calls: a native-driver Animated.event handed to a gesture handler
// crashes on Fabric. The pan only claims clearly horizontal drags, so the
// list still scrolls normally.
function NotificationRow({ item, now, onOpen, onDelete }: Props) {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const styles = useRowStyles(colors);

  const translateX = useRef(new Animated.Value(0)).current;
  const removing = useRef(false);

  const { deleteOpacity, iconScale, cardOpacity } = useMemo(
    () => ({
      deleteOpacity: translateX.interpolate({ inputRange: [-80, -12, 0], outputRange: [1, 0.5, 0], extrapolate: "clamp" }),
      iconScale: translateX.interpolate({ inputRange: [-120, -40, 0], outputRange: [1.1, 0.8, 0.6], extrapolate: "clamp" }),
      cardOpacity: translateX.interpolate({ inputRange: [-width, 0], outputRange: [0.4, 1], extrapolate: "clamp" }),
    }),
    [translateX, width]
  );

  const dismiss = useCallback(() => {
    if (removing.current) return;
    removing.current = true;
    Animated.timing(translateX, {
      toValue: -width,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDelete(item));
  }, [translateX, width, onDelete, item]);

  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (removing.current) return;
      translateX.setValue(Math.min(0, event.nativeEvent.translationX));
    },
    [translateX]
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { oldState, translationX, velocityX } = event.nativeEvent;
      if (oldState !== State.ACTIVE || removing.current) return;
      if (translationX < -width * SWIPE_DISMISS_FRACTION || velocityX < -SWIPE_DISMISS_VELOCITY) {
        dismiss();
        return;
      }
      Animated.spring(translateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }).start();
    },
    [translateX, width, dismiss]
  );

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "delete") dismiss();
    },
    [dismiss]
  );

  const meta = TYPE_META[item.type] ?? FALLBACK_META;
  const toneColor = colors[meta.tone];
  const username = item.sender.username;
  const copy = copyFor(item);
  const sentence = t(copy.phrase, copy.count === undefined ? undefined : { count: copy.count });

  const time = relativeTime(item.createdAt, now);
  const timeLabel =
    time.kind === "relative"
      ? t(time.key, time.count === undefined ? undefined : { count: time.count })
      : new Date(item.createdAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" });

  const spoken = `${copy.afterSender ? `${username} ` : ""}${sentence}${copy.preview ? `: ${copy.preview}` : ""}, ${timeLabel}`;

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.deleteBackground, { opacity: deleteOpacity }]}>
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <Ionicons name="trash" size={22} color={readableOn(colors.error)} />
        </Animated.View>
      </Animated.View>

      <PanGestureHandler
        activeOffsetX={[-14, 14]}
        failOffsetY={[-10, 10]}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[styles.card, !item.read && styles.cardUnread, { opacity: cardOpacity, transform: [{ translateX }] }]}
        >
          <Pressable
            onPress={() => onOpen(item)}
            style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            accessibilityActions={[{ name: "delete", label: t("Delete") }]}
            onAccessibilityAction={onAccessibilityAction}
          >
            <View>
              {item.sender.profile_pic_url ? (
                <Image source={{ uri: item.sender.profile_pic_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{localeUpper(username.slice(0, 2))}</Text>
                </View>
              )}
              <View
                style={[
                  styles.badge,
                  { backgroundColor: toneColor, borderColor: item.read ? colors.base100 : colors.base200 },
                ]}
              >
                <Ionicons name={meta.icon} size={11} color={readableOn(toneColor)} />
              </View>
            </View>

            <View style={styles.body}>
              <Text style={styles.text} numberOfLines={2}>
                {copy.afterSender ? (
                  <>
                    <Text style={styles.emphasis}>{username}</Text> {sentence}
                  </>
                ) : (
                  <Text style={styles.emphasis}>{sentence}</Text>
                )}
              </Text>
              {copy.preview ? (
                <Text style={styles.preview} numberOfLines={2}>
                  {copy.preview}
                </Text>
              ) : null}
              <Text style={styles.time}>{timeLabel}</Text>
            </View>

            {!item.read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

export default memo(NotificationRow);

export const NotificationSectionHeader = memo(function NotificationSectionHeader({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useRowStyles(colors);
  return (
    <Text style={styles.header} accessibilityRole="header">
      {label}
    </Text>
  );
});
