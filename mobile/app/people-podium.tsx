import { View, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import PeoplePodium from "../src/components/PeoplePodium";
import { useTheme } from "../src/context/ThemeContext";

// Dedicated page for Shares' podium — pulled out of SharesFeedSection.tsx,
// reached via PodiumHeaderIcon in Media's header. `jumpToCategory` is set by
// PodiumNewsModal.tsx's own "you made the podium!" popup, navigating here
// directly now instead of drilling the category down through /home's own
// tab-switch plumbing.
export default function PeoplePodiumScreen() {
  const { colors } = useTheme();
  const { jumpToCategory } = useLocalSearchParams<{ jumpToCategory?: string }>();
  const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.base100 } });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <PeoplePodium jumpToCategory={jumpToCategory} />
      </ScrollView>
    </View>
  );
}
