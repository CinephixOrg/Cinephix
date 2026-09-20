import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Pressable from "../../src/components/common/TapSafePressable";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import * as authService from "../../src/api/authService";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";

export default function VerifyEmailScreen() {
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
  const params = useLocalSearchParams<{ email?: string }>();
  const { verifyEmail } = useAuth();
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await verifyEmail(email.trim(), code.trim());
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Verification failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await authService.sendVerificationCode(email.trim());
      setInfo(t("A new code has been sent to your email."));
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Could not resend code."));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("Verify your email")}</Text>
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

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      <Pressable
        style={styles.button}
        onPress={handleVerify}
        disabled={submitting || !email || !code}
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Verify")}</Text>
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

