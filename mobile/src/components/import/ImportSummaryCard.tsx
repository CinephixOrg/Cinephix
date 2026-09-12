import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";
import type { ImportSummary } from "../../types";

interface Props {
  summary: ImportSummary;
  onImportAnother: () => void;
}

// Counts up to its value once, on mount. Driven by an Animated listener
// rather than a timer so the cadence matches everything else on screen, and
// rounded before it reaches state so the number never re-renders on a frame
// that would show the same digits.
function CountUp({ value, style }: { value: number; style: any }) {
  const [shown, setShown] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (value === 0) {
      setShown(0);
      return;
    }
    progress.setValue(0);
    let last = -1;
    const id = progress.addListener(({ value: fraction }) => {
      const next = Math.round(fraction * value);
      if (next !== last) {
        last = next;
        setShown(next);
      }
    });
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      // A listener is the point of this animation, so there is nothing to
      // hand to the native driver.
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.removeListener(id);
    };
  }, [progress, value]);

  return <Text style={style}>{shown}</Text>;
}

export default function ImportSummaryCard({ summary, onImportAnother }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.base200,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.success,
          padding: 18,
          gap: 16,
        },
        header: { flexDirection: "row", alignItems: "center", gap: 10 },
        headerText: { flex: 1 },
        title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.baseContent },
        subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, marginTop: 2 },
        tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
        tile: {
          flexGrow: 1,
          flexBasis: "47%",
          backgroundColor: colors.base100,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          paddingHorizontal: 13,
          gap: 3,
        },
        tileTop: { flexDirection: "row", alignItems: "center", gap: 6 },
        tileValue: { fontFamily: fonts.extrabold, fontSize: 21, color: colors.baseContent },
        tileLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.placeholder },
        section: { gap: 8 },
        sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.baseContent },
        row: { flexDirection: "row", alignItems: "center", gap: 8 },
        rowLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, flex: 1 },
        rowValue: { fontFamily: fonts.medium, fontSize: 12, color: colors.baseContent },
        note: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder, lineHeight: 17 },
        missTitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.baseContent },
        missYear: { fontFamily: fonts.regular, fontSize: 12, color: colors.placeholder },
        button: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.base300,
          borderRadius: 12,
          paddingVertical: 13,
        },
        buttonText: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent },
      }),
    [colors]
  );

  const { added, matched, parsed } = summary;
  const tiles = [
    { key: "watched", value: added.watched, label: t("Added to Watched"), icon: "checkmark-done-outline" as const, color: colors.success },
    { key: "watchlist", value: added.watchlist, label: t("Added to Watchlist"), icon: "bookmark-outline" as const, color: colors.primary },
    { key: "ratings", value: added.ratings, label: t("Ratings imported"), icon: "star-outline" as const, color: colors.warning },
    { key: "favorites", value: added.favorites, label: t("Favorites set"), icon: "heart-outline" as const, color: colors.error },
  ];

  const seconds = Math.max(1, Math.round(summary.durationMs / 1000));
  const accuracy = parsed.titles > 0 ? Math.round((matched.total / parsed.titles) * 100) : 0;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("Import complete")}</Text>
            <Text style={styles.subtitle}>
              {t("{{count}} titles from {{source}} in {{seconds}}s", {
                count: parsed.titles,
                source: summary.sourceLabel,
                seconds,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <View key={tile.key} style={styles.tile}>
              <View style={styles.tileTop}>
                <Ionicons name={tile.icon} size={14} color={tile.color} />
                <CountUp value={tile.value} style={styles.tileValue} />
              </View>
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("How your library was matched")}</Text>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.rowLabel}>{t("Matched to our catalogue")}</Text>
            <Text style={styles.rowValue}>
              {matched.total}/{parsed.titles} ({accuracy}%)
            </Text>
          </View>
          {added.fromTmdb > 0 && (
            <View style={styles.row}>
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.rowLabel}>{t("Newly added to our catalogue")}</Text>
              <Text style={styles.rowValue}>{added.fromTmdb}</Text>
            </View>
          )}
          {added.alreadyHad > 0 && (
            <View style={styles.row}>
              <Ionicons name="albums-outline" size={14} color={colors.placeholder} />
              <Text style={styles.rowLabel}>{t("Already in your profile")}</Text>
              <Text style={styles.rowValue}>{added.alreadyHad}</Text>
            </View>
          )}
          {added.episodes > 0 && (
            <View style={styles.row}>
              <Ionicons name="tv-outline" size={14} color={colors.primary} />
              <Text style={styles.rowLabel}>{t("Episodes counted")}</Text>
              <Text style={styles.rowValue}>{added.episodes}</Text>
            </View>
          )}
        </View>

        {matched.samples.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("{{count}} titles we couldn't find", { count: matched.unmatched })}
            </Text>
            <Text style={styles.note}>
              {t("These weren't in our catalogue and no match could be found online. Everything else imported normally.")}
            </Text>
            {matched.samples.slice(0, 8).map((sample, index) => (
              <View key={`${sample.title}-${index}`} style={styles.row}>
                <Ionicons name="help-circle-outline" size={14} color={colors.placeholder} />
                <Text style={styles.missTitle} numberOfLines={1}>
                  {sample.title}
                </Text>
                {sample.year !== null && <Text style={styles.missYear}>({sample.year})</Text>}
              </View>
            ))}
          </View>
        )}

        {matched.skipped > 0 && (
          <Text style={styles.note}>
            {t("{{count}} more titles were left unchecked to keep the import fast. Run it again to pick up where it left off.", {
              count: matched.skipped,
            })}
          </Text>
        )}

        {summary.replayed && (
          <Text style={styles.note}>
            {t("This file was already imported a moment ago, so we showed you that result instead of importing it twice.")}
          </Text>
        )}

        <Pressable style={styles.button} onPress={onImportAnother}>
          <Ionicons name="refresh" size={16} color={colors.baseContent} />
          <Text style={styles.buttonText}>{t("Import another library")}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
