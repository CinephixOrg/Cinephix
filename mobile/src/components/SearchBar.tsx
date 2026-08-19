import { useEffect, useState, useMemo } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

interface Props {
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceMs?: number;
  // When provided, a settings/filter icon renders at the right end of the
  // bar — used by the Search page's Films/Series tabs to reopen
  // ContentFilterPanel. Omitted entirely (no icon) by the other call sites.
  onFilterPress?: () => void;
}

export default function SearchBar({ placeholder = "Search", onChangeQuery, debounceMs = 400, onFilterPress }: Props) {
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
  input: {
    flex: 1,
    color: colors.baseContent,
    padding: 10,
    fontSize: 16,
  },
  filterButton: { paddingHorizontal: 12, paddingVertical: 10 },
}), [colors]);
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onChangeQuery(value), debounceMs);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
      />
      {onFilterPress && (
        <Pressable style={styles.filterButton} onPress={onFilterPress} hitSlop={8}>
          <Ionicons name="options-outline" size={20} color={colors.baseContent} />
        </Pressable>
      )}
    </View>
  );
}
