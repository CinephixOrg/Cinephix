import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useMyReview } from "../hooks/useMyReview";
import { saveReview, deleteReview } from "../api/reviewService";
import { createShare } from "../api/shareService";
import { useToast } from "../context/ToastContext";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props {
  contentType: ContentType;
  contentId: string;
}

// Full-page review composer — replaces the old small modal
// (ReviewComposer.tsx) per direct ask: a plain, blank writing surface
// instead of a card-styled popup, with Save as ONE unified button (word + a
// downward chevron) — tapping anywhere on it opens the Save Only / Save and
// Share dropdown, unlike the old modal's two separately-tappable halves (a
// text zone that saved directly, a chevron zone that only toggled the
// menu).
//
// The native header is turned off (headerShown:false below) and this
// screen draws its own top bar instead — not for looks, but because the
// dropdown needs to open exactly below the Save button, and a button
// rendered via navigation.setOptions/headerRight lives outside this
// screen's own view tree (portaled into the navigator), so there's no
// reliable way to measure its real on-screen position from here. Once
// Save is a normal sibling in this screen's own layout, the dropdown can
// just be `position:"absolute", top:"100%"` inside a `position:"relative"`
// wrapper around it — the exact technique the old small modal
// (ReviewComposer.tsx) already used successfully for the same dropdown.
//
// This is its own screen now, not an inline modal a parent renders/owns —
// on save or delete it just navigates back rather than calling an onSaved/
// onDeleted prop; the caller (ContentDetailScreen.tsx) refetches its own
// `myReview` via useFocusEffect instead, same as any other screen whose
// data can change from a page it navigated to and back from.
export default function ReviewWriteScreen({ contentType, contentId }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { myReview, myReviewLoading } = useMyReview(contentId, user?._id);

  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Seeds the input from the existing review exactly once, the moment it
  // first arrives — not on every `myReview` change, which would stomp on
  // whatever's actively being typed if this hook's state ever changed
  // again later for some other reason.
  useEffect(() => {
    if (!myReviewLoading && !hydrated) {
      setText(myReview?.text ?? "");
      setHydrated(true);
    }
  }, [myReviewLoading, hydrated, myReview]);

  const handleSave = async (alsoShare: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMenuVisible(false);
    setSaving(true);
    setError(null);
    try {
      const saved = await saveReview(contentId, contentType, trimmed);
      if (alsoShare) {
        try {
          await createShare({ type: "review", reviewId: saved._id });
          showToast(t("Shared to Medya"));
        } catch (e: any) {
          // The review itself saved fine — a failed/blocked share (e.g. the
          // backend's own repeat-share cooldown for this title) shouldn't
          // read as a failed save, just surface the specific reason.
          showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
        }
      }
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to save review."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReview(myReview._id);
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to delete review."));
      setDeleting(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.base100 },
        topBar: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          paddingBottom: 10,
        },
        topBarTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        headerButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
        deleteHeaderText: { color: colors.error, fontFamily: fonts.medium, fontSize: 13 },
        // Wraps just the Save button — position:"relative" anchor for the
        // dropdown below, which needs this exact box's own bottom edge, not
        // a guessed pixel offset from the top of the screen.
        saveWrap: { position: "relative" },
        // One unified Pressable — tapping anywhere on it (word or chevron)
        // opens the Save Only / Save and Share menu, direct ask, unlike the
        // old modal's split save-button/chevron-button pair.
        saveButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          backgroundColor: colors.primary,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 7,
        },
        saveButtonDisabled: { opacity: 0.5 },
        saveButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 14 },
        input: {
          flex: 1,
          fontSize: 16,
          lineHeight: 22,
          color: colors.baseContent,
          padding: 16,
          textAlignVertical: "top",
        },
        error: { color: colors.error, fontSize: 12.5, textAlign: "center", paddingHorizontal: 16, paddingTop: 10 },
        menuBackdrop: { position: "absolute", top: -2000, left: -2000, right: -2000, bottom: -2000 },
        // Anchored to saveWrap, not the screen — always lands exactly below
        // the button regardless of device/safe-area, fixing the earlier
        // guessed-offset version that floated in the wrong spot.
        menu: {
          position: "absolute",
          top: "100%",
          right: 0,
          marginTop: 6,
          backgroundColor: colors.base200,
          borderRadius: 10,
          overflow: "hidden",
          minWidth: 210,
          elevation: 4,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        menuRow: { paddingHorizontal: 14, paddingVertical: 12 },
        menuRowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        menuRowText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
      }),
    [colors, insets.top]
  );

  const canSave = !!text.trim() && !saving && !deleting;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.baseContent} />
        </Pressable>
        <Text style={styles.topBarTitle}>{myReview ? t("Edit Review") : t("Add Review")}</Text>
        <View style={styles.headerButtons}>
          {myReview && (
            <Pressable onPress={handleDelete} disabled={deleting || saving} hitSlop={8}>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={styles.deleteHeaderText}>{t("Delete")}</Text>
              )}
            </Pressable>
          )}
          <View style={styles.saveWrap}>
            <Pressable
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={() => setMenuVisible((v) => !v)}
              disabled={!canSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryContent} />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>{t("Save")}</Text>
                  <Ionicons name="chevron-down" size={14} color={colors.primaryContent} />
                </>
              )}
            </Pressable>
            {menuVisible && (
              <>
                <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)} />
                <View style={styles.menu}>
                  <Pressable style={styles.menuRow} onPress={() => handleSave(false)}>
                    <Text style={styles.menuRowText}>{t("Save Only")}</Text>
                  </Pressable>
                  <View style={styles.menuRowDivider} />
                  <Pressable style={styles.menuRow} onPress={() => handleSave(true)}>
                    <Text style={styles.menuRowText}>{t("Save and Share to Medya")}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        placeholder={t("Write a review...")}
        placeholderTextColor={colors.placeholder}
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        maxLength={2000}
      />
    </View>
  );
}
