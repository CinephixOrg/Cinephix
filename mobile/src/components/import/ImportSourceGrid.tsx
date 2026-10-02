import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import { metaFor } from "./importSourceMeta";
import type { ImportSourceInfo } from "../../types";

interface Props {
  sources: ImportSourceInfo[];
  selectedId: string | null;
  onSelect: (source: ImportSourceInfo) => void;
  disabled?: boolean;
}

interface CardProps {
  source: ImportSourceInfo;
  selected: boolean;
  index: number;
  disabled: boolean;
  onSelect: (source: ImportSourceInfo) => void;
}

// One card. Memoized because selecting a source re-renders the grid, and
// without this all twelve would re-run their style and animation setup for a
// change that only affects two of them.
const SourceCard = memo(function SourceCard({ source, selected, index, disabled, onSelect }: CardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const meta = metaFor(source.id);

  // Selection lift, and a staggered entrance so the grid assembles rather
  // than appearing all at once. Both are transform/opacity only, so both run
  // on the native driver.
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 11) * 28,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [lift, selected]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flex: 1,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.base300 : colors.base200,
          paddingVertical: 14,
          paddingHorizontal: 12,
          gap: 10,
        },
        plate: {
          width: 38,
          height: 38,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          // A low-opacity wash of the brand colour: legible on light and
          // dark themes alike, where a solid brand plate would not be.
          backgroundColor: `${meta.tint}22`,
        },
        label: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
        kinds: { fontFamily: fonts.regular, fontSize: 11, color: colors.placeholder },
        check: { position: "absolute", top: 10, right: 10 },
      }),
    [colors, meta.tint, selected]
  );

  const kindLabel = source.kinds.includes("movie")
    ? source.kinds.includes("series")
      ? t("Movies & series")
      : t("Movies")
    : t("Series");

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
        ],
      }}
    >
      <Pressable
        style={styles.card}
        onPress={() => onSelect(source)}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={source.label}
      >
        <View style={styles.plate}>
          <Ionicons name={meta.icon} size={21} color={meta.tint} />
        </View>
        <View>
          <Text style={styles.label} numberOfLines={1}>
            {source.label}
          </Text>
          <Text style={styles.kinds} numberOfLines={1}>
            {kindLabel}
          </Text>
        </View>
        {selected && (
          <View style={styles.check}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

// Laid out as explicit rows of two rather than a wrapping flex container, so
// the last row never stretches a lone card to full width.
function ImportSourceGrid({ sources, selectedId, onSelect, disabled = false }: Props) {
  const rows = useMemo(() => {
    const out: ImportSourceInfo[][] = [];
    for (let i = 0; i < sources.length; i += 2) out.push(sources.slice(i, i + 2));
    return out;
  }, [sources]);

  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, rowIndex) => (
        <View key={row[0].id} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((source, columnIndex) => (
            <SourceCard
              key={source.id}
              source={source}
              index={rowIndex * 2 + columnIndex}
              selected={source.id === selectedId}
              disabled={disabled}
              onSelect={onSelect}
            />
          ))}
          {/* Keeps a trailing odd card at half width instead of stretching. */}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </View>
  );
}

export default memo(ImportSourceGrid);
