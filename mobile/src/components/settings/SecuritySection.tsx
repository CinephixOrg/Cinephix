import { memo, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { updatePassword } from "../../api/userService";
import SettingsField from "./SettingsField";
import SettingsNotice from "./SettingsNotice";

// Mirrors the server's own rule (validationSchemas.updatePassword), so a
// too-short password is caught before the round trip rather than after it.
const PASSWORD_MIN = 6;

// Password change. Hidden entirely for OAuth accounts, which have no
// password to change.
function SecuritySection() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tooShort = newPassword.length > 0 && newPassword.length < PASSWORD_MIN;
  const canSubmit = oldPassword.length > 0 && newPassword.length >= PASSWORD_MIN && !saving;

  const submit = useCallback(async () => {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await updatePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setMessage(t("Password updated."));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to update password."));
    } finally {
      setSaving(false);
    }
  }, [oldPassword, newPassword, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { padding: 15, gap: 15 },
        revealRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
        revealText: { fontFamily: fonts.medium, fontSize: 12, color: colors.placeholder },
        button: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.base300,
          borderRadius: 12,
          paddingVertical: 13,
        },
        buttonDisabled: { opacity: 0.4 },
        buttonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
      }),
    [colors]
  );

  return (
    <View style={styles.body}>
      <SettingsField
        label={t("Current password")}
        value={oldPassword}
        onChangeText={setOldPassword}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="current-password"
        editable={!saving}
      />
      <SettingsField
        label={t("New password")}
        hint={tooShort ? t("At least {{count}} characters", { count: PASSWORD_MIN }) : undefined}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry={!reveal}
        autoCapitalize="none"
        autoComplete="new-password"
        editable={!saving}
      />

      <Pressable
        style={styles.revealRow}
        onPress={() => setReveal((previous) => !previous)}
        hitSlop={6}
        accessibilityRole="switch"
        accessibilityState={{ checked: reveal }}
      >
        <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={15} color={colors.placeholder} />
        <Text style={styles.revealText}>{reveal ? t("Hide passwords") : t("Show passwords")}</Text>
      </Pressable>

      <SettingsNotice tone="error" message={error} />
      <SettingsNotice tone="success" message={message} />

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={submit}
        disabled={!canSubmit}
      >
        {saving ? (
          <ActivityIndicator color={colors.baseContent} />
        ) : (
          <>
            <Ionicons name="key-outline" size={16} color={colors.baseContent} />
            <Text style={styles.buttonText}>{t("Update Password")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default memo(SecuritySection);
