import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import {
  deleteAccount,
  getUserProfile,
  setOwnAccountTier,
  updateBio,
  updatePassword,
  uploadAvatar,
} from "../../../src/api/userService";
import { changeLanguage } from "../../../src/i18n";
import { useTheme } from "../../../src/context/ThemeContext";
import { PALETTES, THEME_NAMES } from "../../../src/theme/palettes";
import { fonts } from "../../../src/theme/typography";
import type { AccountTier } from "../../../src/types";

const TIER_OPTIONS: AccountTier[] = ["free", "plus", "premium", "dev"];

// Native names — proper nouns, not translated (matches web's LanguageSwitcher.jsx).
const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "ru", name: "Русский" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文" },
  { code: "fr", name: "Français" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "it", name: "Italiano" },
  { code: "es", name: "Español" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.baseContent,
    marginTop: 24,
    marginBottom: 8,
  },
  dangerTitle: { color: colors.error },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 15, color: colors.baseContent },
  rowValue: { fontSize: 15, color: colors.placeholder },
  avatarWrap: { alignItems: "center", marginBottom: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: colors.placeholder, fontSize: 12 },
  changePhoto: { color: colors.secondary, fontFamily: fonts.medium, marginTop: 8 },
  fieldLabel: { color: colors.placeholder, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.baseContent,
    marginBottom: 10,
  },
  bioInput: { minHeight: 90, textAlignVertical: "top" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 28,
  },
  logoutButtonText: { color: colors.baseContent, fontFamily: fonts.medium, fontSize: 16 },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  deleteButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 16 },
  error: { color: colors.error, marginBottom: 12 },
  success: { color: colors.primary, marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.base200, borderRadius: 12, padding: 16, maxHeight: "70%" },
  modalTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, marginBottom: 10 },
  languageRow: { paddingVertical: 12, paddingHorizontal: 4 },
  languageRowText: { fontSize: 15, color: colors.baseContent },
  languageRowTextActive: { color: colors.primary, fontFamily: fonts.bold },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  themeCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.base300,
    backgroundColor: colors.base200,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  themeCardActive: { borderColor: colors.primary, backgroundColor: colors.base300 },
  themeCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  themeCardName: { fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent, textTransform: "capitalize" },
  themeBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  themeBadgeText: { fontSize: 10, fontFamily: fonts.bold, color: colors.primaryContent },
  themeDots: { flexDirection: "row", gap: 6, marginTop: 8 },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  tierOptionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tierOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  tierOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tierOptionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.baseContent, textTransform: "capitalize" },
  tierOptionTextActive: { color: colors.primaryContent },
}), [colors]);
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { themeName, setTheme } = useTheme();

  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.profile_pic_url ?? null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getUserProfile(user._id);
        if (profile.isAuthorized) {
          setBio(profile.bio ?? "");
        }
        setUsername(profile.username);
        setAvatarUri(profile.profile_pic_url ?? null);
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load settings."));
      }
    })();
  }, [user?._id]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setProfileError(t("Photo library permission is required to change your avatar."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedImageUri(result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileError(null);
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      let newAvatarUrl: string | undefined;
      if (pickedImageUri) {
        const res = await uploadAvatar(user._id, pickedImageUri);
        newAvatarUrl = res.profilePicUrl;
      }

      const updated = await updateBio(user._id, { bio, username });

      await updateUser({
        username: updated.username,
        ...(newAvatarUrl ? { profile_pic_url: newAvatarUrl } : {}),
      });

      setPickedImageUri(null);
      setProfileMessage(t("Profile updated."));
    } catch (e: any) {
      setProfileError(e?.response?.data?.message || t("Failed to save profile."));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);
    try {
      await updatePassword(oldPassword, newPassword);
      setPasswordMessage(t("Password updated."));
      setOldPassword("");
      setNewPassword("");
    } catch (e: any) {
      setPasswordError(e?.response?.data?.message || t("Failed to update password."));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("Delete account"),
      t("This permanently deletes your account, ratings, and data. This cannot be undone."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await logout();
            } catch (e: any) {
              setError(e?.response?.data?.message || t("Failed to delete account."));
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleSetTier = async (tier: AccountTier) => {
    if (tier === (user?.accountTier ?? "free") || tierBusy) return;
    setTierBusy(true);
    try {
      const newTier = await setOwnAccountTier(tier);
      await updateUser({ accountTier: newTier });
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to update account tier."));
    } finally {
      setTierBusy(false);
    }
  };

  const currentLanguageName =
    LANGUAGES.find((l) => l.code === i18n.language)?.name ?? LANGUAGES[0].name;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>{t("Edit Profile")}</Text>
      <Pressable onPress={pickImage} style={styles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{t("Add photo")}</Text>
          </View>
        )}
        <Text style={styles.changePhoto}>{t("Change photo")}</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>{t("Username")}</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

      <Text style={styles.fieldLabel}>{t("Bio")}</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder={t("Tell people about yourself")}
      />

      {profileError && <Text style={styles.error}>{profileError}</Text>}
      {profileMessage && <Text style={styles.success}>{profileMessage}</Text>}
      <Pressable style={styles.button} onPress={handleSaveProfile} disabled={profileSaving || !username}>
        {profileSaving ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Save")}</Text>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>{t("Language")}</Text>
      <Pressable style={styles.row} onPress={() => setLanguagePickerVisible(true)}>
        <Text style={styles.rowLabel}>{t("Language")}</Text>
        <Text style={styles.rowValue}>{currentLanguageName}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>{t("Appearance")}</Text>
      <Text style={styles.rowValue}>{t("Choose the theme")}</Text>
      <View style={[styles.themeGrid, { marginTop: 12 }]}>
        {THEME_NAMES.map((name) => {
          const palette = PALETTES[name];
          const isActive = name === themeName;
          return (
            <Pressable
              key={name}
              style={[styles.themeCard, isActive && styles.themeCardActive]}
              onPress={() => setTheme(name)}
            >
              <View style={styles.themeCardHeader}>
                <Text style={styles.themeCardName}>{name}</Text>
                {isActive && (
                  <View style={styles.themeBadge}>
                    <Text style={styles.themeBadgeText}>{t("Active")}</Text>
                  </View>
                )}
              </View>
              <View style={styles.themeDots}>
                <View style={[styles.themeDot, { backgroundColor: palette.primary }]} />
                <View style={[styles.themeDot, { backgroundColor: palette.secondary }]} />
                <View style={[styles.themeDot, { backgroundColor: palette.accent }]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.row} onPress={() => router.push("/profile/activity-log")}>
        <Text style={styles.rowLabel}>{t("Activity Log")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => router.push("/profile/import")}>
        <Text style={styles.rowLabel}>{t("Import Data")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => router.push("/profile/about")}>
        <Text style={styles.rowLabel}>{t("About")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => router.push("/profile/privacy")}>
        <Text style={styles.rowLabel}>{t("Privacy Policy")}</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => router.push("/profile/terms")}>
        <Text style={styles.rowLabel}>{t("Terms of Service")}</Text>
      </Pressable>

      {!user?.isOAuthUser && (
        <>
          <Text style={styles.sectionTitle}>{t("Change Password")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("Current password")}
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TextInput
            style={styles.input}
            placeholder={t("New password")}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {passwordError && <Text style={styles.error}>{passwordError}</Text>}
          {passwordMessage && <Text style={styles.success}>{passwordMessage}</Text>}
          <Pressable
            style={styles.button}
            onPress={handlePasswordChange}
            disabled={passwordSaving || !oldPassword || !newPassword}
          >
            {passwordSaving ? (
              <ActivityIndicator color={colors.primaryContent} />
            ) : (
              <Text style={styles.buttonText}>{t("Update Password")}</Text>
            )}
          </Pressable>
        </>
      )}

      {__DEV__ && (
        <>
          <Text style={styles.sectionTitle}>{t("Dev Tools")}</Text>
          <Text style={styles.rowValue}>
            {t("Simulate a purchase to test tier-gated features. No real billing yet.")}
          </Text>
          <View style={styles.tierOptionsRow}>
            {TIER_OPTIONS.map((tier) => {
              const isActive = (user?.accountTier ?? "free") === tier;
              return (
                <Pressable
                  key={tier}
                  style={[styles.tierOption, isActive && styles.tierOptionActive]}
                  onPress={() => handleSetTier(tier)}
                  disabled={tierBusy}
                >
                  {tierBusy && isActive ? (
                    <ActivityIndicator color={colors.primaryContent} size="small" />
                  ) : (
                    <Text style={[styles.tierOptionText, isActive && styles.tierOptionTextActive]}>
                      {tier}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        style={styles.logoutButton}
        onPress={async () => {
          await logout();
          router.replace("/login");
        }}
      >
        <Text style={styles.logoutButtonText}>{t("Log Out")}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, styles.dangerTitle]}>{t("Danger Zone")}</Text>
      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={deleting}>
        {deleting ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.deleteButtonText}>{t("Delete Account")}</Text>
        )}
      </Pressable>

      <Modal visible={languagePickerVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setLanguagePickerVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("Language")}</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.languageRow}
                  onPress={async () => {
                    await changeLanguage(item.code);
                    setLanguagePickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageRowText,
                      item.code === i18n.language && styles.languageRowTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

