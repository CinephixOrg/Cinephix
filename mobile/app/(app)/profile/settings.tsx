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
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../src/context/AuthContext";
import {
  deleteAccount,
  getMyProfile,
  updatePassword,
  updateVisibility,
} from "../../../src/api/userService";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [isPrivate, setIsPrivate] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getMyProfile(user._id);
        setIsPrivate(profile.visibility === "private");
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load settings.");
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
      setError(e?.response?.data?.message || "Failed to update privacy.");
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
      setPasswordMessage("Password updated.");
      setOldPassword("");
      setNewPassword("");
    } catch (e: any) {
      setPasswordError(e?.response?.data?.message || "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account, ratings, and data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await logout();
            } catch (e: any) {
              setError(e?.response?.data?.message || "Failed to delete account.");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>Privacy</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Private account</Text>
        <Switch
          value={isPrivate}
          onValueChange={togglePrivacy}
          disabled={visibilityBusy}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {!user?.isOAuthUser && (
        <>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Current password"
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="New password"
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
              <Text style={styles.buttonText}>Update Password</Text>
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
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
      <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={deleting}>
        {deleting ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={styles.deleteButtonText}>Delete Account</Text>
        )}
      </Pressable>
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
});
