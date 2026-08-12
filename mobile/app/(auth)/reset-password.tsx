import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as authService from "../../src/api/authService";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
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
  info: { color: colors.secondary },
  link: { textAlign: "center", marginTop: 16, color: colors.secondary },
}), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (newPassword.length < 6) {
      setError(t("Password must be at least 6 characters."));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }
    setSubmitting(true);
    try {
      await authService.resetPassword(email.trim(), code.trim(), newPassword);
      router.replace("/login");
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to reset password."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await authService.forgotPassword(email.trim());
      setInfo(t("A new code has been sent to your email."));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Failed to send reset code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("Reset your password")}</Text>
      <Text style={styles.subtitle}>
        {t("Enter the code we sent to your email address.")}
      </Text>

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
        placeholder={t("Verification code")}
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
      />
      <TextInput
        style={styles.input}
        placeholder={t("New password")}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={styles.input}
        placeholder={t("Confirm new password")}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable
        style={styles.button}
        onPress={handleSubmit}
        disabled={submitting || !email || !code || !newPassword || !confirmPassword}
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Reset Password")}</Text>
        )}
      </Pressable>

      <Pressable onPress={handleResend} disabled={resending || !email}>
        <Text style={styles.link}>
          {resending ? t("Sending...") : t("Resend code")}
        </Text>
      </Pressable>
    </View>
  );
}

