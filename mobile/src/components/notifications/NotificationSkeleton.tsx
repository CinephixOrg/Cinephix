import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonBox } from "../Skeleton";

const ROWS = 7;

// The first-visit placeholder, drawn with NotificationRow's own margins,
// padding, radius and avatar size so the real cards land exactly where the
// placeholders were.
function NotificationSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { paddingTop: 4 },
        header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
        card: {
          flexDirection: "row",
          gap: 12,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        lines: { flex: 1, gap: 7, paddingTop: 4 },
      }),
    [colors]
  );

  return (
    <View style={styles.list} pointerEvents="none">
      <View style={styles.header}>
        <SkeletonBox width={64} height={12} />
      </View>
      {Array.from({ length: ROWS }, (_, index) => (
        <View key={index} style={styles.card}>
          <SkeletonBox width={46} height={46} borderRadius={23} />
          <View style={styles.lines}>
            <SkeletonBox width={index % 2 === 0 ? "78%" : "62%"} height={13} />
            <SkeletonBox width={44} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default memo(NotificationSkeleton);
