import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import Modal from "../common/GestureModal";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { PALETTES } from "../../theme/palettes";
import { updateGroupIdentity, updateGroupFeedSettings, uploadGroupCoverImage } from "../../api/groupService";
import { FeedAnnouncementsToggle } from "../lists/ListEditorParts";
import type { Group, GroupAnnouncementCategory } from "../../types";
import { fonts } from "../../theme/typography";

const FEED_ANNOUNCEMENT_CATEGORIES: GroupAnnouncementCategory[] = ["challenge", "watchparty", "list", "leaderboard"];

// A plain curated swatch set (each theme palette's own `primary`) rather
// than a full color picker — matches this app's own established palette
// language instead of inventing new hex values, and keeps this a one-tap
// choice (the agreed scope: "tek bir vurgu rengi", not a full theme).
const ACCENT_SWATCHES = Object.values(PALETTES).map((p) => p.primary);

type Colors = ReturnType<typeof useTheme>["colors"];

function createStyles(colors: Colors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.base100 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
    close: { padding: 6 },
    body: { padding: 16, gap: 18 },
    label: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.5, color: colors.placeholder, marginBottom: 8 },
    swatchRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
    swatchSelected: { borderColor: colors.baseContent },
    input: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.baseContent,
      backgroundColor: colors.base200,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    nameInput: { fontFamily: fonts.bold, fontSize: 14 },
    descriptionInput: { minHeight: 70, textAlignVertical: "top" },
    coverWrap: { height: 120, borderRadius: 14, backgroundColor: colors.base200, overflow: "hidden", alignItems: "center", justifyContent: "center" },
    coverImage: { width: "100%", height: "100%" },
    coverEmpty: { alignItems: "center", gap: 6 },
    coverEmptyText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder },
    coverEditBadge: {
      position: "absolute",
      bottom: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    coverEditBadgeText: { fontFamily: fonts.bold, fontSize: 11.5, color: "#fff" },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.base200, borderRadius: 10, paddingHorizontal: 12 },
    inputRowText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent, paddingVertical: 10 },
    saveButton: { height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    saveText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
    saveDisabled: { opacity: 0.5 },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    listName: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.baseContent },
    infoBox: { backgroundColor: colors.base200, borderRadius: 12, padding: 12 },
    infoText: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.placeholder },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: colors.border },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent },
    chipTextActive: { fontFamily: fonts.bold, color: colors.primaryContent },
  });
}

interface IdentityModalProps {
  visible: boolean;
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

// Owner-only: name, cover image, bio, accent color, and the
// Instagram/TikTok/YouTube links — every piece of a partner community's
// own identity in one place.
export function EditCommunityIdentityModal({ visible, group, onClose, onSaved }: IdentityModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [coverPreviewUri, setCoverPreviewUri] = useState<string | null>(group.coverImage || null);
  const [pickedCoverUri, setPickedCoverUri] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(group.accentColor ?? null);
  const [instagram, setInstagram] = useState(group.socialLinks?.instagram ?? "");
  const [tiktok, setTiktok] = useState(group.socialLinks?.tiktok ?? "");
  const [youtube, setYoutube] = useState(group.socialLinks?.youtube ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(group.name);
    setDescription(group.description);
    setCoverPreviewUri(group.coverImage || null);
    setPickedCoverUri(null);
    setAccentColor(group.accentColor ?? null);
    setInstagram(group.socialLinks?.instagram ?? "");
    setTiktok(group.socialLinks?.tiktok ?? "");
    setYoutube(group.socialLinks?.youtube ?? "");
  }, [visible, group]);

  const pickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(t("Photo library permission is required to change your avatar."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setPickedCoverUri(result.assets[0].uri);
    setCoverPreviewUri(result.assets[0].uri);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (pickedCoverUri) await uploadGroupCoverImage(group.slug, pickedCoverUri);
      await updateGroupIdentity(group.slug, {
        name: name.trim() || group.name,
        description: description.trim(),
        accentColor,
        socialLinks: { instagram: instagram.trim() || null, tiktok: tiktok.trim() || null, youtube: youtube.trim() || null },
      });
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("Edit Community")}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.baseContent} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View>
            <Text style={styles.label}>{t("Cover Image")}</Text>
            <Pressable style={styles.coverWrap} onPress={pickCoverImage}>
              {coverPreviewUri ? (
                <Image source={{ uri: coverPreviewUri }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverEmpty}>
                  <Ionicons name="image-outline" size={24} color={colors.placeholder} />
                  <Text style={styles.coverEmptyText}>{t("Add a cover image")}</Text>
                </View>
              )}
              <View style={styles.coverEditBadge}>
                <Ionicons name="camera-outline" size={13} color="#fff" />
                <Text style={styles.coverEditBadgeText}>{t("Edit")}</Text>
              </View>
            </Pressable>
          </View>
          <View>
            <Text style={styles.label}>{t("Community Name")}</Text>
            <TextInput style={[styles.input, styles.nameInput]} value={name} onChangeText={setName} placeholderTextColor={colors.placeholder} maxLength={60} />
          </View>
          <View>
            <Text style={styles.label}>{t("Bio")}</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("Tell people what this community is about")}
              placeholderTextColor={colors.placeholder}
              maxLength={300}
              multiline
            />
          </View>
          <View>
            <Text style={styles.label}>{t("Accent Color")}</Text>
            <View style={styles.swatchRow}>
              {ACCENT_SWATCHES.map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => setAccentColor(hex)}
                  style={[styles.swatch, { backgroundColor: hex }, accentColor === hex && styles.swatchSelected]}
                />
              ))}
            </View>
          </View>
          <View>
            <Text style={styles.label}>{t("Social Links")}</Text>
            <View style={{ gap: 10 }}>
              <View style={styles.inputRow}>
                <Ionicons name="logo-instagram" size={18} color={colors.placeholder} />
                <TextInput
                  style={styles.inputRowText}
                  value={instagram}
                  onChangeText={setInstagram}
                  placeholder="instagram.com/..."
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="logo-tiktok" size={18} color={colors.placeholder} />
                <TextInput
                  style={styles.inputRowText}
                  value={tiktok}
                  onChangeText={setTiktok}
                  placeholder="tiktok.com/@..."
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="logo-youtube" size={18} color={colors.placeholder} />
                <TextInput
                  style={styles.inputRowText}
                  value={youtube}
                  onChangeText={setYoutube}
                  placeholder="youtube.com/@..."
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
          <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.saveText}>{t("Save")}</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface FeedSettingsModalProps {
  visible: boolean;
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_LABEL: Record<GroupAnnouncementCategory, string> = {
  challenge: "Challenge",
  watchparty: "Watch Party",
  list: "List",
  leaderboard: "Leaderboard",
};

// Owner-only: opt a community into Discover's "Community Announcements"
// rail (GroupAnnouncement.js's own comment has the full feature picture)
// — member-only there regardless of this setting, never the Shares/Media
// feed. Off and empty by default.
export function EditFeedAnnouncementsModal({ visible, group, onClose, onSaved }: FeedSettingsModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(group.feedAnnouncements?.enabled ?? false);
  const [categories, setCategories] = useState<GroupAnnouncementCategory[]>(group.feedAnnouncements?.categories ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEnabled(group.feedAnnouncements?.enabled ?? false);
    setCategories(group.feedAnnouncements?.categories ?? []);
  }, [visible, group]);

  const toggleCategory = (category: GroupAnnouncementCategory) => {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateGroupFeedSettings(group.slug, { enabled, categories });
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("Feed Announcements")}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.baseContent} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {t(
                "When on, new challenges, watch parties, lists, and the weekly leaderboard result are automatically announced to your community's own members in Discover — in whichever categories you pick below. Non-members never see these."
              )}
            </Text>
          </View>
          <View>
            <Text style={styles.label}>{t("Status")}</Text>
            <FeedAnnouncementsToggle enabled={enabled} onChange={setEnabled} />
          </View>
          {enabled ? (
            <View>
              <Text style={styles.label}>{t("Categories")}</Text>
              <View style={styles.chipsWrap}>
                {FEED_ANNOUNCEMENT_CATEGORIES.map((category) => {
                  const active = categories.includes(category);
                  return (
                    <Pressable key={category} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleCategory(category)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(CATEGORY_LABEL[category])}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.saveText}>{t("Save")}</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface AdminPanelModalProps {
  visible: boolean;
  onClose: () => void;
  onEditIdentity: () => void;
  onPinList: () => void;
  onNewPoll: () => void;
  onNewChallenge: () => void;
  onNewWatchParty: () => void;
  onFeedAnnouncements: () => void;
}

// Every admin-only action in one place — direct ask, after these used to
// sit as a loose row of buttons mixed into the main Overview content
// ("çok dağınık duruyor"). Opened from a single gear icon in the
// community's own compact header (GroupDetailScreen), so it's reachable
// from any tab, not just Overview.
export function AdminPanelModal({ visible, onClose, onEditIdentity, onPinList, onNewPoll, onNewChallenge, onNewWatchParty, onFeedAnnouncements }: AdminPanelModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }[] = [
    { icon: "color-palette-outline", label: t("Edit Community"), onPress: onEditIdentity },
    { icon: "albums-outline", label: t("Create Community List"), onPress: onPinList },
    { icon: "bar-chart-outline", label: t("New Poll"), onPress: onNewPoll },
    { icon: "trophy-outline", label: t("New Challenge"), onPress: onNewChallenge },
    { icon: "calendar-outline", label: t("New Watch Party"), onPress: onNewWatchParty },
    { icon: "megaphone-outline", label: t("Feed Announcements"), onPress: onFeedAnnouncements },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("Manage Community")}</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.baseContent} />
          </Pressable>
        </View>
        {actions.map((action) => (
          <Pressable key={action.label} style={styles.listRow} onPress={action.onPress}>
            <Ionicons name={action.icon} size={19} color={colors.baseContent} />
            <Text style={styles.listName}>{action.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.placeholder} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
