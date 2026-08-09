import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import { signInWithGoogle } from "../../src/api/googleAuth";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login, completeOAuthLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Login failed. Check your credentials."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const oauthUser = await signInWithGoogle();
      await completeOAuthLogin(oauthUser);
    } catch (e: any) {
      setError(e?.message || t("Google sign-in failed."));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cinephix</Text>

      <TextInput
        style={styles.input}
        placeholder={t("Email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder={t("Password")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting || !email || !password}
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Log in")}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={googleSubmitting}
      >
        {googleSubmitting ? (
          <ActivityIndicator color={colors.baseContent} />
        ) : (
          <Text style={styles.googleButtonText}>{t("Sign in with Google")}</Text>
        )}
      </Pressable>

      <Link href="/register" style={styles.link}>
        {t("Don't have an account? Register")}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.base100 },
  title: {
    fontSize: 32,
    fontFamily: fonts.bold,
    textAlign: "center",
    marginBottom: 24,
    color: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.baseContent,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 16 },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  googleButtonText: { color: colors.baseContent, fontFamily: fonts.medium, fontSize: 16 },
  error: { color: colors.error },
  link: { textAlign: "center", marginTop: 16, color: colors.secondary },
});
