import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Pressable from "../../src/components/common/TapSafePressable";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import { signInWithGoogle } from "../../src/api/googleAuth";
import { openLegal } from "../../src/constants/legal";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
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
  notice: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: `${colors.error}1A`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.error}55`,
  },
  noticeText: { fontSize: 13.5, lineHeight: 19, color: colors.error, textAlign: "center" },
  legal: { fontSize: 12, lineHeight: 17, color: colors.placeholder, textAlign: "center", marginTop: 10 },
  legalLink: { color: colors.primary },
  error: { color: colors.error },
  link: { textAlign: "center", marginTop: 16, color: colors.secondary },
  forgotLink: { textAlign: "right", color: colors.secondary, fontSize: 13 },
}), [colors]);
  const { t } = useTranslation();
  const { login, completeOAuthLogin, signedOutReason, clearSignedOutReason } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const dismissNotice = () => {
    if (signedOutReason) clearSignedOutReason();
  };

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
        onChangeText={(next) => {
          dismissNotice();
          setEmail(next);
        }}
      />
      <TextInput
        style={styles.input}
        placeholder={t("Password")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Link href="/forgot-password" style={styles.forgotLink}>
        {t("Forgot password?")}
      </Link>

      {/* A suspended account is signed out mid-session; this is where it
          finds out why (src/api/client.ts). */}
      {signedOutReason ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{signedOutReason}</Text>
        </View>
      ) : null}

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

      <Text style={styles.legal}>
        {t("By continuing you agree to our")}{" "}
        <Text style={styles.legalLink} onPress={() => openLegal("terms")}>
          {t("Terms of Service")}
        </Text>{" "}
        {t("and")}{" "}
        <Text style={styles.legalLink} onPress={() => openLegal("privacy")}>
          {t("Privacy Policy")}
        </Text>
        .
      </Text>

      <Link href="/register" style={styles.link}>
        {t("Don't have an account? Register")}
      </Link>
    </View>
  );
}

