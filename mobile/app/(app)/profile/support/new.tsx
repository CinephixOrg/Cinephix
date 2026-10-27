import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import Animated, {
  makeMutable,
  scrollTo,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedRef,
  useScrollOffset,
  useSharedValue,
} from "react-native-reanimated";
import { Pressable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import KeyboardInsetView from "../../../../src/components/common/KeyboardInsetView";
import { useKeyboardSafeExit } from "../../../../src/hooks/useKeyboardSafeExit";
import { submitTicket } from "../../../../src/api/ticketStore";
import { TICKET_TYPE_OPTIONS } from "../../../../src/utils/tickets";
import { useToast } from "../../../../src/context/ToastContext";
import { useTheme } from "../../../../src/context/ThemeContext";
import { fonts } from "../../../../src/theme/typography";
import type { TicketType } from "../../../../src/types";

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
// Room left above the Title label when the fields are scrolled up to be typed in.
const FIELD_TOP_MARGIN = 12;
// How long the form's height has to hold still before the keyboard counts as
// open: the form shrinks frame by frame while the keyboard animates in.
const KEYBOARD_SETTLE_MS = 100;
// Before the keyboard has been seen to open, how much of the window it's
// expected to take up.
const KEYBOARD_GUESS = 0.4;

// How tall the keyboard opened last time — what the scroll follows towards
// while it opens again, since an opening's own height isn't known until it
// has finished. Kept for as long as the app runs.
const lastKeyboardHeight = makeMutable(0);

type Field = "title" | "details";

// Writing to support: what kind of thing it is, a one-line summary and the
// details. The type is picked from cards rather than a dropdown — four
// options read faster than a menu, and each says what it's for.
export default function NewTicketScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  useKeyboardSafeExit();

  const [type, setType] = useState<TicketType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  // Typing in either field brings Title and Details up together, from the
  // Title label down, so moving from one to the other needs no scrolling.
  //
  // When the keyboard opens for a field, the form scrolls up along with it,
  // frame by frame on the UI thread, arriving as the keyboard does. How far
  // the keyboard will open isn't known until it has, so the scroll follows
  // last time's height (a guess the first time), and once the form has
  // settled above the keyboard anything still off is put right. Moving
  // between fields with the keyboard already up scrolls only if the field
  // tapped isn't fully in view.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const keyboard = useAnimatedKeyboard();
  const { height: windowHeight } = useWindowDimensions();
  const fields = useRef<Record<Field, LayoutRectangle | null>>({ title: null, details: null });
  const viewportHeight = useRef(0);
  const focusOnKeyboardOpen = useRef<Field | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The scroll the keyboard is being followed from and to; -1 when it isn't.
  const followFrom = useSharedValue(0);
  const followTo = useSharedValue(-1);

  useAnimatedReaction(
    () => keyboard.height.value,
    (height) => {
      if (followTo.value < 0) return;
      const expected = lastKeyboardHeight.value || windowHeight * KEYBOARD_GUESS;
      const progress = Math.min(height / expected, 1);
      scrollTo(scrollRef, 0, followFrom.value + (followTo.value - followFrom.value) * progress, false);
    }
  );

  const bringFieldsIntoView = (field: Field, always: boolean) => {
    const tapped = fields.current[field];
    const titleField = fields.current.title;
    if (!tapped || !titleField) return;
    const top = scrollOffset.value;
    const inView = tapped.y >= top && tapped.y + tapped.height <= top + viewportHeight.current;
    if (inView && !always) return;
    let y = titleField.y - FIELD_TOP_MARGIN;
    // Too short a screen for both: the tapped field, from its label.
    if (tapped.y + tapped.height > y + viewportHeight.current) y = tapped.y - FIELD_TOP_MARGIN;
    y = Math.max(y, 0);
    if (Math.abs(y - top) > 1) scrollRef.current?.scrollTo({ y, animated: true });
  };

  const onFieldFocus = (field: Field) => {
    if (Keyboard.isVisible()) {
      bringFieldsIntoView(field, false);
      return;
    }
    focusOnKeyboardOpen.current = field;
    const titleField = fields.current.title;
    if (titleField) {
      followFrom.value = scrollOffset.value;
      followTo.value = Math.max(titleField.y - FIELD_TOP_MARGIN, 0);
    }
  };

  const onViewportLayout = (height: number) => {
    viewportHeight.current = height;
    if (!focusOnKeyboardOpen.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const field = focusOnKeyboardOpen.current;
      focusOnKeyboardOpen.current = null;
      followTo.value = -1;
      if (keyboard.height.value > 0) lastKeyboardHeight.value = keyboard.height.value;
      if (field) bringFieldsIntoView(field, true);
    }, KEYBOARD_SETTLE_MS);
  };

  useEffect(() => {
    // Keyboard closed before the form settled: nothing left to scroll for.
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      focusOnKeyboardOpen.current = null;
      followTo.value = -1;
    });
    return () => {
      hide.remove();
      clearTimeout(settleTimer.current);
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        fill: { flex: 1 },
        content: { padding: 16, paddingBottom: 40, gap: 22 },
        label: { fontFamily: fonts.bold, fontSize: 13, color: colors.placeholder, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
        types: { gap: 8 },
        typeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 16,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        typeRowActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
        typeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.base300 },
        typeIconActive: { backgroundColor: `${colors.primary}26` },
        typeText: { flex: 1, minWidth: 0 },
        typeLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
        typeDescription: { fontSize: 12.5, lineHeight: 17, color: colors.placeholder, marginTop: 1 },
        input: {
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15.5,
          fontFamily: fonts.regular,
          color: colors.baseContent,
        },
        textarea: { minHeight: 150, textAlignVertical: "top", lineHeight: 21 },
        counter: { alignSelf: "flex-end", marginTop: 6, fontSize: 11.5, color: colors.placeholder },
        submit: {
          height: 52,
          borderRadius: 26,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
        },
        submitDisabled: { opacity: 0.45 },
        submitText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primaryContent },
        hint: { fontSize: 12.5, lineHeight: 18, color: colors.placeholder, textAlign: "center" },
      }),
    [colors]
  );

  const ready = Boolean(type) && title.trim().length >= 3 && description.trim().length >= 10;

  const send = async () => {
    if (!ready || !type || sending) return;
    setSending(true);
    try {
      await submitTicket({ type, title: title.trim(), description: description.trim() });
      showToast(t("Thanks — we've got your ticket."), "success");
      router.back();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
      setSending(false);
    }
  };

  return (
    // KeyboardInsetView on Android, KeyboardAvoidingView on iOS: the form
    // shrinks to the space above the keyboard, so the field being typed in
    // can be scrolled into view instead of ending up underneath it.
    <KeyboardInsetView style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => onViewportLayout(e.nativeEvent.layout.height)}
        >
          <View>
            <Text style={styles.label}>{t("What's this about?")}</Text>
            <View style={styles.types}>
              {TICKET_TYPE_OPTIONS.map((option) => {
                const active = type === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setType(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [styles.typeRow, active && styles.typeRowActive, pressed && { opacity: 0.85 }]}
                  >
                    <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                      <Ionicons name={option.icon} size={19} color={active ? colors.primary : colors.placeholder} />
                    </View>
                    <View style={styles.typeText}>
                      <Text style={styles.typeLabel}>{t(option.label)}</Text>
                      <Text style={styles.typeDescription}>{t(option.description)}</Text>
                    </View>
                    <Ionicons
                      name={active ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={active ? colors.primary : colors.border}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View onLayout={(e) => (fields.current.title = e.nativeEvent.layout)}>
            <Text style={styles.label}>{t("Title")}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              onFocus={() => onFieldFocus("title")}
              maxLength={MAX_TITLE}
              placeholder={t("A short summary")}
              placeholderTextColor={colors.placeholder}
              returnKeyType="next"
            />
            <Text style={styles.counter}>
              {title.length}/{MAX_TITLE}
            </Text>
          </View>

          <View onLayout={(e) => (fields.current.details = e.nativeEvent.layout)}>
            <Text style={styles.label}>{t("Details")}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              onFocus={() => onFieldFocus("details")}
              maxLength={MAX_DESCRIPTION}
              multiline
              placeholder={t("What happened, and what you expected instead. The more detail, the faster we can help.")}
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.counter}>
              {description.length}/{MAX_DESCRIPTION}
            </Text>
          </View>

          <Pressable
            onPress={send}
            disabled={!ready || sending}
            accessibilityRole="button"
            style={({ pressed }) => [styles.submit, (!ready || sending) && styles.submitDisabled, pressed && { opacity: 0.85 }]}
          >
            {sending ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.submitText}>{t("Send ticket")}</Text>}
          </Pressable>
          <Text style={styles.hint}>{t("We'll reply in Help & Feedback and notify you on this device.")}</Text>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </KeyboardInsetView>
  );
}
