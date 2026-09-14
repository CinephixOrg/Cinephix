import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { SkeletonBox } from "../Skeleton";
import { rowHeightOf, tilePosition, type GridMetrics } from "./gridModel";

// The non-grid states every collection view shares: loading, empty, error,
// private, no matches.

// Placeholder for a loading grid, laid out by the grid's own geometry.
//
// It used to be a wrapping flex row with a right margin on every tile but the
// fifth. Flex wrapping re-derives each row from the container's real width,
// so whenever that was even a pixel narrower than the width the tile size was
// computed from — inside the bordered public-list sheet, for one — the fifth
// tile wrapped onto the next row and every row after it came out crooked.
// CollectionGrid places posters with tilePosition, and so does this: same
// positions, same size, same radius and base color, so every poster appears
// exactly where its placeholder was.
export const CollectionSkeleton = memo(function CollectionSkeleton({ metrics }: { metrics: GridMetrics }) {
  const { height: windowHeight } = useWindowDimensions();
  // Enough rows for the tallest the grid can be; anything below it is clipped.
  const count = Math.ceil(windowHeight / rowHeightOf(metrics)) * metrics.columns;

  return (
    <View style={styles.skeleton} pointerEvents="none">
      {Array.from({ length: count }, (_, index) => {
        const { x, y } = tilePosition(index, metrics);
        return (
          <SkeletonBox
            key={index}
            width={metrics.tileWidth}
            height={metrics.tileHeight}
            borderRadius={8}
            style={{ position: "absolute", left: 0, top: 0, transform: [{ translateX: x }, { translateY: y }] }}
          />
        );
      })}
    </View>
  );
});

interface StateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
}

export const CollectionStateView = memo(function CollectionStateView({ icon, title, text, action }: StateProps) {
  const { colors } = useTheme();
  const themed = useMemo(
    () =>
      StyleSheet.create({
        icon: { backgroundColor: colors.base200 },
        title: { color: colors.baseContent },
        text: { color: colors.placeholder },
        button: { backgroundColor: colors.primary },
        buttonText: { color: colors.primaryContent },
      }),
    [colors]
  );

  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, themed.icon]}>
        <Ionicons name={icon} size={30} color={colors.placeholder} />
      </View>
      <Text style={[styles.stateTitle, themed.title]}>{title}</Text>
      {text ? <Text style={[styles.stateText, themed.text]}>{text}</Text> : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.stateButton, themed.button, pressed && styles.pressed]}
        >
          <Text style={[styles.stateButtonText, themed.buttonText]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: { flex: 1, overflow: "hidden" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 10, paddingBottom: 80 },
  stateIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  stateTitle: { fontFamily: fonts.extrabold, fontSize: 17, textAlign: "center" },
  stateText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, textAlign: "center" },
  stateButton: { marginTop: 8, height: 42, borderRadius: 21, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  stateButtonText: { fontFamily: fonts.bold, fontSize: 14 },
  pressed: { transform: [{ scale: 0.97 }] },
});
