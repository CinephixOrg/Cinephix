import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import {
  deleteAccount,
  getMyProfile,
  updatePassword,
  updateVisibility,
} from "../../../src/api/userService";
import { changeLanguage } from "../../../src/i18n";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

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
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [isPrivate, setIsPrivate] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getMyProfile(user._id);
        setIsPrivate(profile.visibility === "private");
      } catch (e: any) {
        setError(e?.response?.data?.message || t("Failed to load settings."));
      }
    })();
  }, [user?._id]);

  const togglePrivacy = async (value: boolean) => {
    setIsPrivate(value);
    setVisibilityBusy(true);
    try {
      await updateVisibility(value ? "private" : "public");
    } catch (e: any) {
      setIsPrivate(!value);
      setError(e?.response?.data?.message || t("Failed to update privacy."));
    } finally {
      setVisibilityBusy(false);
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

  const currentLanguageName =
    LANGUAGES.find((l) => l.code === i18n.language)?.name ?? LANGUAGES[0].name;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>{t("Privacy")}</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t("Private account")}</Text>
        <Switch
          value={isPrivate}
          onValueChange={togglePrivacy}
          disabled={visibilityBusy}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <Text style={styles.sectionTitle}>{t("Language")}</Text>
      <Pressable style={styles.row} onPress={() => setLanguagePickerVisible(true)}>
        <Text style={styles.rowLabel}>{t("Language")}</Text>
        <Text style={styles.rowValue}>{currentLanguageName}</Text>
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

const styles = StyleSheet.create({
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
});
