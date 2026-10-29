import { View, ScrollView, StyleSheet } from "react-native";
import LeaderboardPodium from "../src/components/LeaderboardPodium";
import { useTheme } from "../src/context/ThemeContext";

// Dedicated page for Discover's podium — pulled out of KesfetSection.tsx,
// reached via PodiumHeaderIcon in Media's header. Plain RN ScrollView, not gesture-
// handler's: unlike on Discover itself, this page has no horizontal-pager
// ancestor, so the same-axis nesting constraint that forces gesture-handler
// elsewhere doesn't apply here.
export default function ContentPodiumScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.base100 } });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <LeaderboardPodium basePath="/home" />
      </ScrollView>
    </View>
  );
}
