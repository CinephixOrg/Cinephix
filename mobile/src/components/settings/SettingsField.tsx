import { forwardRef, memo, useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

interface Props extends TextInputProps {
  label: string;
  /** Right-aligned hint, used for the bio's character counter. */
  hint?: string;
  multiline?: boolean;
}

// A labelled input matching the card styling. Kept separate so a keystroke
// re-renders one field rather than its whole section.
const SettingsField = forwardRef<TextInput, Props>(function SettingsField(
  { label, hint, multiline, style, ...rest },
  ref
) {
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 7 },
        header: { flexDirection: "row", alignItems: "center" },
        label: {
          fontFamily: fonts.medium,
          fontSize: 12,
          color: colors.placeholder,
          flex: 1,
        },
        hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.placeholder },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base100,
          borderRadius: 12,
          paddingHorizontal: 13,
          paddingVertical: 12,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: colors.baseContent,
        },
        multiline: { minHeight: 88, textAlignVertical: "top" },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput
        ref={ref}
        style={[styles.input, multiline && styles.multiline, style]}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
});

export default memo(SettingsField);
