import { useEffect, useRef, useMemo } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { ColorPalette } from "../theme/palettes";

// Shared by every Skeleton* component below (they're siblings, not nested,
// so the style object can't just be built once inside SkeletonBox like the
// migration script assumed — each component calls this hook itself).
function useSkeletonStyles() {
  const { colors } = useTheme();
  return useMemo(() => buildStyles(colors), [colors]);
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    gridTight: { justifyContent: "flex-start" },
    cell2: { width: "48%", marginBottom: 16 },
    cell3: { width: "33.33%", alignItems: "center", padding: 10 },
    poster: { aspectRatio: 2 / 3 },
    groupCard: { width: "100%", backgroundColor: colors.base200, borderRadius: 12, padding: 14 },
    rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowCenter: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    avatarCell: { alignItems: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    activityLogRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    listRow: { backgroundColor: colors.base200, borderRadius: 10, padding: 14, marginBottom: 10 },
    profileHeader: { alignItems: "center", padding: 20 },
    groupDetailHeader: { padding: 16 },
    chatBubbles: { padding: 16, gap: 10 },
    bubbleRowOther: { alignItems: "flex-start" },
    bubbleRowOwn: { alignItems: "flex-end" },
    podiumRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, marginBottom: 20 },
    podiumSlot: { alignItems: "center" },
    matchCard: { width: "100%", backgroundColor: colors.base200, borderRadius: 12, padding: 14, alignItems: "center" },
    railSection: { marginBottom: 24 },
    railRow: { flexDirection: "row", paddingHorizontal: 16 },
    railCell: { width: 120, marginRight: 12 },
    railPoster: { aspectRatio: 2 / 3 },
  });
}

// Base pulsing placeholder box. RN has no CSS animate-pulse equivalent, so
// this hand-rolls the same effect (opacity loop) via the built-in Animated
// API — react-native-reanimated isn't installed and isn't needed for this.
export function SkeletonBox({
  width,
  height,
  borderRadius = 6,
  style,
}: {
  width: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, borderRadius, backgroundColor: colors.base300, opacity },
        height !== undefined && { height },
        style,
      ]}
    />
  );
}

// Generic grid wrapper — same wrap/space-between layout every real grid
// screen already uses, parameterized by a per-cell renderer so posters,
// group cards, and avatar cells can all share one layout implementation.
export function SkeletonGrid({
  count,
  columns,
  renderItem,
}: {
  count: number;
  columns: 2 | 3;
  renderItem: (index: number) => React.ReactNode;
}) {
  const styles = useSkeletonStyles();
  return (
    <View style={[styles.grid, columns === 3 && styles.gridTight]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={columns === 2 ? styles.cell2 : styles.cell3}>
          {renderItem(i)}
        </View>
      ))}
    </View>
  );
}

export function SkeletonPosterCard() {
  const styles = useSkeletonStyles();
  return (
    <View>
      <SkeletonBox width="100%" style={styles.poster} borderRadius={8} />
      <SkeletonBox width="90%" height={14} style={{ marginTop: 6 }} />
      <SkeletonBox width="50%" height={12} style={{ marginTop: 4 }} />
    </View>
  );
}

export function SkeletonGroupCard() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.groupCard}>
      <View style={styles.rowBetween}>
        <SkeletonBox width={60} height={16} borderRadius={10} />
        <SkeletonBox width={30} height={12} />
      </View>
      <SkeletonBox width="80%" height={15} style={{ marginTop: 10 }} />
      <SkeletonBox width="100%" height={12} style={{ marginTop: 6 }} />
      <SkeletonBox width="70%" height={12} style={{ marginTop: 4 }} />
      <View style={[styles.rowBetween, { marginTop: 8, gap: 6 }]}>
        <SkeletonBox width={50} height={16} borderRadius={8} />
        <SkeletonBox width={50} height={16} borderRadius={8} />
      </View>
      <SkeletonBox width="100%" height={30} style={{ marginTop: 10 }} borderRadius={8} />
    </View>
  );
}

export function SkeletonAvatarCell() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.avatarCell}>
      <SkeletonBox width={52} height={52} borderRadius={26} />
      <SkeletonBox width={60} height={11} style={{ marginTop: 6 }} />
      <SkeletonBox width={50} height={9} style={{ marginTop: 4 }} />
    </View>
  );
}

// Avatar + N configurable text lines — covers notifications, connections,
// user-search results, and the messages inbox.
export function SkeletonRow({ lines = 1 }: { lines?: 1 | 2 }) {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.row}>
      <SkeletonBox width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="60%" height={13} />
        {lines === 2 && <SkeletonBox width="85%" height={11} />}
      </View>
    </View>
  );
}

// Matches activity-log.tsx's row shape — checkbox + type icon + two text
// lines, no avatar, so SkeletonRow's avatar-shaped circle doesn't fit here.
export function SkeletonActivityLogRow() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.activityLogRow}>
      <SkeletonBox width={20} height={20} borderRadius={4} />
      <SkeletonBox width={20} height={20} borderRadius={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="55%" height={13} />
        <SkeletonBox width="80%" height={11} />
      </View>
    </View>
  );
}

// Matches lists/index.tsx's own row shape (no avatar — title+badge+desc+count).
export function SkeletonListRow() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.listRow}>
      <View style={styles.rowBetween}>
        <SkeletonBox width={120} height={15} />
        <SkeletonBox width={50} height={16} borderRadius={10} />
      </View>
      <SkeletonBox width="70%" height={12} style={{ marginTop: 8 }} />
      <SkeletonBox width={60} height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

export function SkeletonProfileHeader() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.profileHeader}>
      <SkeletonBox width={96} height={96} borderRadius={48} />
      <SkeletonBox width={140} height={20} style={{ marginTop: 12 }} />
      <SkeletonBox width={100} height={12} style={{ marginTop: 8 }} />
      <View style={[styles.rowCenter, { gap: 32, marginTop: 16 }]}>
        <SkeletonBox width={40} height={30} />
        <SkeletonBox width={40} height={30} />
      </View>
      <SkeletonBox width="80%" height={12} style={{ marginTop: 16 }} />
      <SkeletonBox width="60%" height={12} style={{ marginTop: 6 }} />
      <View style={[styles.rowCenter, { gap: 12, marginTop: 20, alignSelf: "stretch" }]}>
        <SkeletonBox width="48%" height={40} borderRadius={8} />
        <SkeletonBox width="48%" height={40} borderRadius={8} />
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.rowCenter, { gap: 20, marginTop: 24 }]}>
          <SkeletonBox width={130} height={130} borderRadius={65} />
          <View style={{ gap: 8 }}>
            <SkeletonBox width={100} height={10} />
            <SkeletonBox width={90} height={10} />
            <SkeletonBox width={110} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonGroupDetailHeader() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.groupDetailHeader}>
      <View style={styles.rowBetween}>
        <SkeletonBox width={70} height={20} borderRadius={10} />
        <SkeletonBox width={70} height={28} borderRadius={8} />
      </View>
      <SkeletonBox width="60%" height={22} style={{ marginTop: 10 }} />
      <SkeletonBox width="90%" height={13} style={{ marginTop: 8 }} />
      <SkeletonBox width="40%" height={12} style={{ marginTop: 10 }} />
    </View>
  );
}

export function SkeletonChatBubbles() {
  const widths: Array<`${number}%`> = ["55%", "40%", "65%", "35%"];
  const styles = useSkeletonStyles();
  return (
    <View style={styles.chatBubbles}>
      {widths.map((w, i) => (
        <View key={i} style={i % 2 === 0 ? styles.bubbleRowOther : styles.bubbleRowOwn}>
          <SkeletonBox width={w} height={36} borderRadius={14} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonRail() {
  const styles = useSkeletonStyles();
  return (
    <View style={styles.railSection}>
      <SkeletonBox width={140} height={16} style={{ marginLeft: 16, marginBottom: 12 }} />
      <View style={styles.railRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.railCell}>
            <SkeletonBox width="100%" style={styles.railPoster} borderRadius={8} />
            <SkeletonBox width="80%" height={12} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SkeletonMatchResults() {
  const styles = useSkeletonStyles();
  return (
    <View>
      <View style={styles.podiumRow}>
        {[1, 0, 2].map((slotIndex) => (
          <View key={slotIndex} style={[styles.podiumSlot, slotIndex === 1 && { marginBottom: 12 }]}>
            <SkeletonBox
              width={slotIndex === 1 ? 72 : 56}
              height={slotIndex === 1 ? 72 : 56}
              borderRadius={36}
            />
            <SkeletonBox width={70} height={11} style={{ marginTop: 8 }} />
            <SkeletonBox width={40} height={13} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
      <SkeletonGrid
        count={6}
        columns={2}
        renderItem={() => (
          <View style={styles.matchCard}>
            <SkeletonBox width={56} height={56} borderRadius={28} />
            <SkeletonBox width={80} height={13} style={{ marginTop: 8 }} />
            <SkeletonBox width={70} height={70} borderRadius={35} style={{ marginTop: 10 }} />
            <SkeletonBox width="100%" height={30} style={{ marginTop: 10 }} borderRadius={8} />
          </View>
        )}
      />
    </View>
  );
}

