import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  totalSteps: number;
  currentStep: number; // 0-indexed
}

// Thin N-segment bar for the first-run taste-onboarding wizard (TC-133) —
// no existing step-indicator pattern in this app to reuse, this is new.
export default function StepProgressBar({ totalSteps, currentStep }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
        segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.base300 },
        segmentFilled: { backgroundColor: colors.primary },
      }),
    [colors]
  );

  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View key={i} style={[styles.segment, i <= currentStep && styles.segmentFilled]} />
      ))}
    </View>
  );
}
