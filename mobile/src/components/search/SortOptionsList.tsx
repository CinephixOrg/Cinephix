import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

// Single-select radio-style rows — shared by Lists/Reviews' own sort
// filters inside FilterBottomSheet.
export default function SortOptionsList<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 22 },
        sectionLabel: {
          fontFamily: fonts.bold,
          fontSize: 12,
          color: colors.placeholder,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 10,
        },
        row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
        rowText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.baseContent },
        rowTextActive: { fontFamily: fonts.bold, color: colors.primary },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
      }),
    [colors]
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <View key={option.value}>
            <Pressable style={styles.row} onPress={() => onChange(option.value)}>
              <Text style={[styles.rowText, active && styles.rowTextActive]}>{option.label}</Text>
              {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </Pressable>
            {i < options.length - 1 && <View style={styles.divider} />}
          </View>
        );
      })}
    </View>
  );
}
