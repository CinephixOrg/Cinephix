import { useMemo } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { LegalTitle, LegalSection, LegalParagraph, LegalLink } from "../../../src/components/LegalPage";
import { ICON_ATTRIBUTIONS } from "../../../src/data/iconAttributions";
import { useTheme } from "../../../src/context/ThemeContext";
import type { ColorPalette } from "../../../src/theme/palettes";

// Static, hardcoded-English page — same convention about.tsx/privacy.tsx/
// terms.tsx already use for this kind of legal-adjacent content, not run
// through t(). Satisfies IconScout's own attribution requirement (each
// icon's license says its credit link has to be shown "wherever it's
// used") via one central page rather than a visible link under every tiny
// badge, which isn't legible at that size anyway.
export default function CreditsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalTitle>Credits</LegalTitle>
      <LegalSection heading="Icons">
        <LegalParagraph>
          Badge and decorative icons in Cinephix are licensed from IconScout. Attribution for each,
          as required by its license:
        </LegalParagraph>
        {ICON_ATTRIBUTIONS.map((item) => (
          <Text key={item.name} style={styles.row}>
            <LegalLink href={item.iconUrl}>{item.name}</LegalLink> by{" "}
            <LegalLink href={item.authorUrl}>{item.authorName}</LegalLink> on{" "}
            <LegalLink href="https://iconscout.com">IconScout</LegalLink>
          </Text>
        ))}
      </LegalSection>
    </ScrollView>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 },
    row: { fontSize: 13.5, color: colors.baseContent, lineHeight: 22, opacity: 0.85, marginBottom: 6 },
  });
}
