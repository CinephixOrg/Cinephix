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
import { useAuth } from "../../src/context/AuthContext";
import { openLegal } from "../../src/constants/legal";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/context/ThemeContext";
import { fonts } from "../../src/theme/typography";
import { useKeyboardSafeExit } from "../../src/hooks/useKeyboardSafeExit";

export default function RegisterScreen() {
  const { colors } = useTheme();
  useKeyboardSafeExit();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.base100 },
  title: { fontSize: 28, fontFamily: fonts.bold, textAlign: "center", marginBottom: 24, color: colors.primary },
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
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.placeholder },
  termsLink: { color: colors.primary, fontFamily: fonts.bold },
  buttonDisabled: { opacity: 0.5 },
  link: { textAlign: "center", marginTop: 16, color: colors.secondary },
}), [colors]);
  const { t } = useTranslation();
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await register(username.trim(), email.trim(), password, acceptedTerms);
      router.push({ pathname: "/verify-email", params: { email: email.trim() } });
    } catch (e: any) {
      setError(e?.response?.data?.message || t("Registration failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("Create account")}</Text>

      <TextInput
        style={styles.input}
        placeholder={t("Username")}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
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

      {/* Apple requires agreement to the terms at sign-up, and the API
          refuses a registration without it. */}
      <Pressable
        style={styles.termsRow}
        onPress={() => setAcceptedTerms((on) => !on)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acceptedTerms }}
        accessibilityLabel={t("I agree to the Terms of Service and Privacy Policy")}
      >
        <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
          {acceptedTerms ? <Ionicons name="checkmark" size={15} color={colors.primaryContent} /> : null}
        </View>
        <Text style={styles.termsText}>
          {t("I agree to the")}{" "}
          <Text style={styles.termsLink} onPress={() => openLegal("terms")}>
            {t("Terms of Service")}
          </Text>{" "}
          {t("and")}{" "}
          <Text style={styles.termsLink} onPress={() => openLegal("privacy")}>
            {t("Privacy Policy")}
          </Text>
          .
        </Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (!acceptedTerms || !username || !email || !password) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !username || !email || !password || !acceptedTerms}
      >
        {submitting ? (
          <ActivityIndicator color={colors.primaryContent} />
        ) : (
          <Text style={styles.buttonText}>{t("Register")}</Text>
        )}
      </Pressable>

      <Link href="/login" style={styles.link}>
        {t("Already have an account? Log in")}
      </Link>
    </View>
  );
}

