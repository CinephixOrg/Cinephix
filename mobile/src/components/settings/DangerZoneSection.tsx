import { memo, useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { deleteAccount } from "../../api/userService";
import SettingsRow from "./SettingsRow";
import SettingsSection from "./SettingsSection";
import ConfirmDialog from "./ConfirmDialog";
import SettingsNotice from "./SettingsNotice";

// Sign out and account deletion.
//
// Deletion is confirmed through the app's own ConfirmDialog rather than the
// platform alert, so the one irreversible action doesn't arrive in a box
// that looks like it belongs to a different product. The weight comes from
// the styling instead: a solid red confirm button and a red-tinted plate.
function DangerZoneSection() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }, [logout, router]);

  const runDelete = useCallback(async () => {
    setConfirming(false);
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      await logout();
      router.replace("/login");
    } catch (e: any) {
      // Reported inline rather than in a second dialog — stacking one alert
      // on top of another is how people end up dismissing both blind.
      setError(e?.response?.data?.message || t("Failed to delete account."));
      setDeleting(false);
    }
  }, [t, logout, router]);

  // Two sections rather than one: signing out is routine and reversible,
  // deleting is neither, and putting them on the same card would give them
  // the same weight.
  return (
    <>
      <SettingsSection title={t("Session")}>
        <SettingsRow
          icon="log-out-outline"
          label={t("Log Out")}
          onPress={signOut}
          disabled={loggingOut}
          divider={false}
          accessory={loggingOut ? <ActivityIndicator size="small" color={colors.baseContent} /> : undefined}
        />
      </SettingsSection>

      <SettingsSection title={t("Danger Zone")} danger>
        <SettingsRow
          icon="trash-outline"
          label={t("Delete account")}
          description={t("Permanently removes your profile, ratings and lists")}
          onPress={() => setConfirming(true)}
          disabled={deleting}
          destructive
          divider={false}
          accessory={deleting ? <ActivityIndicator size="small" color={colors.error} /> : undefined}
        />
        {error ? (
          <View style={{ paddingHorizontal: 15, paddingBottom: 14 }}>
            <SettingsNotice tone="error" message={error} />
          </View>
        ) : null}
      </SettingsSection>

      <ConfirmDialog
        visible={confirming}
        icon="trash-outline"
        title={t("Delete account")}
        message={t("This permanently deletes your account, ratings, and data. This cannot be undone.")}
        confirmLabel={t("Delete")}
        cancelLabel={t("Cancel")}
        danger
        emphasis="solid"
        onConfirm={runDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export default memo(DangerZoneSection);
