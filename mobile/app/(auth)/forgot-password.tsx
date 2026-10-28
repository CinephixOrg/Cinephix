import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Pressable from "../../src/components/common/TapSafePressable";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as authService from "../../src/api/authService";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";
import { useKeyboardSafeExit } from "../../src/hooks/useKeyboardSafeExit";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  useKeyboardSafeExit();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.base100 },
  title: { fontSize: 26, fontFamily: fonts.bold, textAlign: "center", color: colors.primary },
  subtitle: { textAlign: "center", color: colors.placeholder, marginBottom: 12 },
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
  error: { color: colors.error },
  link: { textAlign: "center", marginTop: 16, color: colors.secondary },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await authService.forgotPassword(email.trim());
      router.push({ pathname: "/reset-password", params: { email: email.trim() } });
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to send reset code."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("Reset your password")}</Text>
      <Text style={styles.subtitle}>{t("Enter your email to receive a reset code.")}</Text>

      <TextInput
        placeholderTextColor={colors.placeholder}
        style={styles.input}
        placeholder={t("Email")}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting || !email}>
        {submitting ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Send Reset Code")}</Text>
        )}
      </Pressable>

      <Link href="/login" style={styles.link}>
        {t("Already have an account? Log in")}
      </Link>
    </View>
  );
}

