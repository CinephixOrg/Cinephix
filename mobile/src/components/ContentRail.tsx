import { useMemo } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

interface Props<T> {
  title: string;
  subtitle?: string;
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  emptyText: string;
}

// First horizontal poster-rail pattern in the app — generic over item type
// so Popular This Week / For You / Discover Lists all share one layout
// instead of three bespoke rail implementations.
export default function ContentRail<T>({
  title,
  subtitle,
  data,
  keyExtractor,
  renderItem,
  emptyText,
}: Props<T>) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // alignSelf:"stretch" matters when a parent uses alignItems:"center" (e.g.
        // the Profile screens) — without it the rail would shrink-wrap instead of
        // spanning full width. A no-op on parents that already stretch by default.
        section: { marginBottom: 24, alignSelf: "stretch" },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent, paddingHorizontal: 16 },
        subtitle: { fontSize: 12, color: colors.placeholder, marginTop: 2, paddingHorizontal: 16 },
        railContent: { paddingHorizontal: 16, paddingTop: 12 },
        empty: { color: colors.placeholder, fontSize: 13, paddingHorizontal: 16, marginTop: 12 },
      }),
    [colors]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {data.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.railContent}
          renderItem={({ item }) => <>{renderItem(item)}</>}
        />
      )}
    </View>
  );
}
