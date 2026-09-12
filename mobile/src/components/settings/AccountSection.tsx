import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { updateBio, uploadAvatar } from "../../api/userService";
import SettingsField from "./SettingsField";
import SettingsNotice from "./SettingsNotice";

// Mirror the server's limits (backend/middleware/validation.js and the User
// model), so a too-long bio or bad username is caught while the user is
// still looking at the field instead of after a round trip.
const BIO_MAX = 250;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

interface Props {
  userId: string;
  initialUsername: string;
  initialBio: string;
  initialAvatar: string | null;
  /**
   * Reports whether there are edits that would be lost. The screen needs
   * this to guard back navigation, and takes it as a callback rather than
   * lifting the form state up — keeping the fields' state down here is the
   * whole reason a keystroke doesn't re-render the rest of the page.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

// Identity: avatar, username, bio.
//
// Owns all of its own state. That is the whole reason this is a component
// rather than a block inside the screen — typing in the bio field used to
// re-render every other section, including the theme strip's nine previews,
// on every keystroke.
function AccountSection({
  userId,
  initialUsername,
  initialBio,
  initialAvatar,
  onDirtyChange,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { updateUser } = useAuth();
  const { refresh } = useProfile();

  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [avatarUri, setAvatarUri] = useState<string | null>(initialAvatar);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // What is currently on the server. Compared against rather than the props,
  // which never change after mount — comparing to those left the form
  // permanently "dirty" after the first successful save.
  const [saved, setSaved] = useState({ username: initialUsername.trim(), bio: initialBio });

  const trimmedUsername = username.trim();
  const dirty = trimmedUsername !== saved.username || bio !== saved.bio || pickedImageUri !== null;

  // Checked here rather than only on the server, so the user finds out while
  // they are still looking at the field.
  const usernameProblem =
    trimmedUsername.length === 0
      ? t("Username can't be empty.")
      : trimmedUsername.length < USERNAME_MIN
        ? t("Username must be at least {{count}} characters.", { count: USERNAME_MIN })
        : trimmedUsername.length > USERNAME_MAX
          ? t("Username can be at most {{count}} characters.", { count: USERNAME_MAX })
          : null;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Leaving with edits still pending is no longer this component's problem
  // once it is gone, and a stale "dirty" would block the next screen.
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const pickImage = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("Photo library permission is required to change your avatar."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPickedImageUri(result.assets[0].uri);
    setAvatarUri(result.assets[0].uri);
    setMessage(null);
  }, [t]);

  const save = useCallback(async () => {
    if (usernameProblem) {
      setError(usernameProblem);
      return;
    }
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      let uploadedUrl: string | undefined;
      if (pickedImageUri) {
        const result = await uploadAvatar(userId, pickedImageUri);
        uploadedUrl = result.profilePicUrl;
      }
      const updated = await updateBio(userId, { bio, username: trimmedUsername });
      await updateUser({
        username: updated.username,
        ...(uploadedUrl ? { profile_pic_url: uploadedUrl } : {}),
      });
      setPickedImageUri(null);
      setUsername(updated.username);
      setSaved({ username: updated.username.trim(), bio });
      setMessage(t("Profile updated."));
      // Settings now reads from the profile cache, so it has to learn about
      // the save too — otherwise reopening Settings (or the Profile header)
      // would show the old bio until the cache next expired. Not awaited:
      // the form is already showing the saved values.
      refresh({ force: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to save profile."));
    } finally {
      setSaving(false);
    }
  }, [usernameProblem, pickedImageUri, userId, bio, trimmedUsername, updateUser, refresh, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: { padding: 15, gap: 15 },
        identity: { flexDirection: "row", alignItems: "center", gap: 14 },
        avatarWrap: { width: 66, height: 66 },
        avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.base300 },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        badge: {
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.base200,
        },
        identityText: { flex: 1, gap: 2 },
        name: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent },
        hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder },
        button: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 13,
        },
        buttonDisabled: { opacity: 0.4 },
        buttonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryContent },
      }),
    [colors]
  );

  const canSave = dirty && !saving && !usernameProblem;

  return (
    <View style={styles.body}>
      <View style={styles.identity}>
        <Pressable
          style={styles.avatarWrap}
          onPress={pickImage}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t("Change photo")}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={28} color={colors.placeholder} />
            </View>
          )}
          <View style={styles.badge}>
            <Ionicons name="camera" size={13} color={colors.primaryContent} />
          </View>
        </Pressable>
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {trimmedUsername || initialUsername}
          </Text>
          <Text style={styles.hint}>{t("Tap your photo to change it")}</Text>
        </View>
      </View>

      <SettingsField
        label={t("Username")}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={USERNAME_MAX}
        editable={!saving}
        returnKeyType="done"
      />

      <SettingsField
        label={t("Bio")}
        hint={`${bio.length}/${BIO_MAX}`}
        value={bio}
        onChangeText={setBio}
        placeholder={t("Tell people about yourself")}
        multiline
        maxLength={BIO_MAX}
        editable={!saving}
      />

      <SettingsNotice tone="error" message={error} />
      <SettingsNotice tone="success" message={message} />

      <Pressable
        style={[styles.button, !canSave && styles.buttonDisabled]}
        onPress={save}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <>
            <Ionicons name="checkmark" size={16} color={colors.primaryContent} />
            <Text style={styles.buttonText}>{dirty ? t("Save changes") : t("Saved")}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default memo(AccountSection);
