import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TICKET_STATUS_META } from "../../utils/tickets";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { TicketStatus } from "../../types";

// A ticket's status, colour-coded: waiting on us is warm, being worked on is
// informative, done is green, closed is quiet. The colours are the theme's
// own, so every palette carries it (src/theme/palettes.ts).
function StatusBadge({ status, large = false }: { status: TicketStatus; large?: boolean }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const meta = TICKET_STATUS_META[status] ?? TICKET_STATUS_META.Open;
  const tone = meta.tone === "neutral" ? colors.placeholder : colors[meta.tone];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: large ? 12 : 9,
          paddingVertical: large ? 6 : 4,
          borderRadius: 999,
          backgroundColor: `${tone}22`,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: `${tone}55`,
        },
        text: { fontFamily: fonts.bold, fontSize: large ? 13 : 11.5, color: tone },
      }),
    [tone, large]
  );

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{t(meta.label)}</Text>
    </View>
  );
}

export default memo(StatusBadge);
