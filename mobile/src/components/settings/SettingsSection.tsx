import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props {
  title: string;
  /** Optional one-line explanation under the title, outside the card. */
  caption?: string;
  /** Renders the card in the error colour, for destructive groups. */
  danger?: boolean;
  children: React.ReactNode;
}

// A titled group of rows on one card.
//
// The card is the only container in the settings page: every section looks
// identical, so scanning the page is a matter of reading titles rather than
// decoding four different visual treatments. Dividers between rows are drawn
// by SettingsRow itself, which is what keeps this component free of any
// child-counting logic.
//
// Deliberately not memo'd: it takes `children`, which is a fresh element on
// every parent render, so a shallow prop compare could never hit. The
// re-render protection that matters lives on the leaves (SettingsRow,
// ThemePicker, AccountSection...), whose props are primitives and stable
// callbacks — this component re-rendering is two Views and a Text.
function SettingsSection({ title, caption, danger = false, children }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 8 },
        // Deliberately not uppercased. RN's textTransform is applied
        // natively and honours the *device* locale, so on a Turkish-locale
        // phone it turns a lowercase "i" into "İ" even when the app is in
        // English — "Security" rendered as "SECURİTY". Sentence case avoids
        // the hazard entirely and reads cleaner than small caps.
        title: {
          fontFamily: fonts.bold,
          fontSize: 13,
          color: danger ? colors.error : colors.baseContent,
          marginLeft: 4,
        },
        caption: {
          fontFamily: fonts.regular,
          fontSize: 12,
          lineHeight: 17,
          color: colors.placeholder,
          marginLeft: 4,
          marginTop: -2,
        },
        card: {
          backgroundColor: colors.base200,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: danger ? colors.error : colors.border,
          overflow: "hidden",
        },
      }),
    [colors, danger]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default SettingsSection;
