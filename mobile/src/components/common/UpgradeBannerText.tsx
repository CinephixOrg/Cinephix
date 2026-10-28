import { memo, useMemo } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Pressable from "./TapSafePressable";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

/**
 * `sentence` split around the first `word` in it (case aside, in the
 * language's own casing rules), or null when it isn't there.
 */
function splitAround(sentence: string, word: string, language: string): [string, string, string] | null {
  if (!word) return null;
  const at = sentence.toLocaleLowerCase(language).indexOf(word.toLocaleLowerCase(language));
  return at < 0 ? null : [sentence.slice(0, at), sentence.slice(at, at + word.length), sentence.slice(at + word.length)];
}

/**
 * A podium's "Upgrade to see …" banner, for categories the viewer's plan
 * doesn't include: the whole sentence opens the plans, not just the corner
 * ribbon (FB-15), and its "Upgrade" is styled as the link — in the languages
 * whose sentence carries the word itself. Shared by Discover's content podium
 * and Media's people podium.
 */
function UpgradeBannerText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        press: { flex: 1 },
        link: { fontFamily: fonts.bold, color: colors.primary, textDecorationLine: "underline" },
      }),
    [colors]
  );
  const parts = splitAround(text, t("Upgrade"), i18n.language);
  return (
    <Pressable style={styles.press} onPress={() => router.push("/match/subscription" as any)} accessibilityRole="link">
      <Text style={style}>
        {parts ? (
          <>
            {parts[0]}
            <Text style={styles.link}>{parts[1]}</Text>
            {parts[2]}
          </>
        ) : (
          text
        )}
      </Text>
    </Pressable>
  );
}

export default memo(UpgradeBannerText);
