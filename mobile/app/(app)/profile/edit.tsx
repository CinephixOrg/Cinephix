import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../src/context/AuthContext";
import { getMyProfile, updateBio, uploadAvatar } from "../../../src/api/userService";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.profile_pic_url ?? null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getMyProfile(user._id);
        setBio(profile.bio ?? "");
        setUsername(profile.username);
        setAvatarUri(profile.profile_pic_url ?? null);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?._id]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to change your avatar.");
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

  const handleSave = async () => {
    if (!user) return;
    setError(null);
    setSaving(true);
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

      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={pickImage} style={styles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>Add photo</Text>
          </View>
        )}
        <Text style={styles.changePhoto}>Change photo</Text>
      </Pressable>

      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Tell people about yourself"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSave} disabled={saving || !username}>
        {saving ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.base100 },
  avatarWrap: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.base200 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: colors.placeholder, fontSize: 12 },
  changePhoto: { color: colors.secondary, fontFamily: fonts.medium, marginTop: 8 },
  label: { color: colors.placeholder, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.baseContent,
  },
  bioInput: { minHeight: 90, textAlignVertical: "top" },
  error: { color: colors.error, marginTop: 12 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
});
