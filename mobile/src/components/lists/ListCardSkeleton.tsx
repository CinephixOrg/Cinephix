import { memo, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { SkeletonBox } from "../Skeleton";
import { useTheme } from "../../context/ThemeContext";

// The page's horizontal padding (16 each side) plus the card's own (12 each side).
const HORIZONTAL_INSET = 56;

// Placeholder for a DiscoverListCard, laid out on the card's own measurements
// (name row, 84pt film strip, count and engagement row), so a loaded card
// takes the placeholder's place without the content below it moving.
function ListCardSkeleton() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const inner = width - HORIZONTAL_INSET;
  const themed = useMemo(() => ({ backgroundColor: colors.base200 }), [colors]);

  return (
    <View style={[styles.card, themed]} pointerEvents="none">
      <View style={styles.row}>
        <SkeletonBox width={Math.round(inner * 0.5)} height={16} borderRadius={6} />
        <SkeletonBox width={22} height={22} borderRadius={11} />
      </View>
      <SkeletonBox width={inner} height={86} borderRadius={8} style={styles.strip} />
      <View style={[styles.row, styles.footer]}>
        <SkeletonBox width={56} height={11} borderRadius={5} />
        <SkeletonBox width={88} height={11} borderRadius={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 12, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  strip: { marginTop: 10 },
  footer: { marginTop: 10 },
});

export default memo(ListCardSkeleton);
