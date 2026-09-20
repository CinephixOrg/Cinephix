import { useEffect, useState, useMemo } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

interface Props {
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceMs?: number;
  // When provided, a filter icon renders at the right end of the bar — used
  // by the Search page's Films/Series/Lists/Reviews tabs to open their own
  // FilterBottomSheet. Omitted entirely (no icon) by the other call sites.
  onFilterPress?: () => void;
  // Whether the currently-active tab has any filter actually applied — a
  // filled, tinted button instead of a bare outline one, so "something's
  // filtered" is visible at a glance without opening the sheet.
  filterActive?: boolean;
}

export default function SearchBar({ placeholder = "Search", onChangeQuery, debounceMs = 400, onFilterPress, filterActive }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  searchIcon: { marginLeft: 12 },
  input: {
    flex: 1,
    color: colors.baseContent,
    padding: 10,
    paddingLeft: 8,
    fontSize: 16,
  },
  filterButtonWrap: { paddingRight: 6 },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { backgroundColor: colors.primary },
}), [colors]);
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onChangeQuery(value), debounceMs);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color={colors.placeholder} style={styles.searchIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
      />
      {onFilterPress && (
        <View style={styles.filterButtonWrap}>
          <Pressable style={[styles.filterButton, filterActive && styles.filterButtonActive]} onPress={onFilterPress} hitSlop={8}>
            <Ionicons name="options-outline" size={18} color={filterActive ? colors.primaryContent : colors.baseContent} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
