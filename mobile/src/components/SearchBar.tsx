import { useEffect, useState, useMemo } from "react";
import { TextInput, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  placeholder?: string;
  onChangeQuery: (query: string) => void;
  debounceMs?: number;
}

export default function SearchBar({ placeholder = "Search", onChangeQuery, debounceMs = 400 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.base200,
    color: colors.baseContent,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
}), [colors]);
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onChangeQuery(value), debounceMs);
    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      value={value}
      onChangeText={setValue}
      autoCapitalize="none"
    />
  );
}

