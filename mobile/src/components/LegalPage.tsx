import { useMemo, type ReactNode } from "react";
import { View, Text, Linking, StyleSheet } from "react-native";
import type { ColorPalette } from "../theme/palettes";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Shared structural chrome for About/Privacy Policy/Terms of Service — three
// near-identical static prose screens, mirroring web's own choice to keep
// each as its own hardcoded component rather than a generic data-driven
// renderer (this content is static and rarely touched).
function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    title: { fontFamily: fonts.bold, fontSize: 24, color: colors.primary, marginBottom: 4 },
    updated: { fontSize: 12, color: colors.placeholder, marginBottom: 20 },
    section: { marginBottom: 20 },
    heading: { fontFamily: fonts.bold, fontSize: 16, color: colors.baseContent, marginBottom: 6 },
    paragraph: { fontSize: 14, color: colors.baseContent, lineHeight: 21, opacity: 0.85 },
    bulletRow: { flexDirection: "row", marginTop: 2 },
    bulletDot: { fontSize: 14, color: colors.baseContent, opacity: 0.85, marginRight: 6 },
    bulletText: { flex: 1, fontSize: 14, color: colors.baseContent, lineHeight: 21, opacity: 0.85 },
    link: { color: colors.primary },
  });
}

export function LegalTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return <Text style={styles.title}>{children}</Text>;
}

export function LegalUpdated({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return <Text style={styles.updated}>{children}</Text>;
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{heading}</Text>
      {children}
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return <Text style={styles.paragraph}>{children}</Text>;
}

export function LegalBullets({ items }: { items: string[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>{"•"}</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  return (
    <Text style={styles.link} onPress={() => Linking.openURL(href)}>
      {children}
    </Text>
  );
}
