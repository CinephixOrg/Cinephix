import { useMemo } from "react";
import { View, Image, ScrollView, StyleSheet } from "react-native";
import { LegalTitle, LegalSection, LegalParagraph, LegalBullets, LegalLink } from "../../../src/components/LegalPage";
import { useTheme } from "../../../src/context/ThemeContext";

export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 },
        header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
        logo: { width: 36, height: 40, resizeMode: "contain" },
      }),
    [colors]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image source={require("../../../assets/cinephix_logo.png")} style={styles.logo} />
        <LegalTitle>About Cinephix</LegalTitle>
      </View>

      <LegalSection heading="What is Cinephix?">
        <LegalParagraph>
          Cinephix is a social platform built for film and series enthusiasts. Whether you're a
          casual viewer or a dedicated cinephile, Cinephix gives you the tools to discover new
          content, track what you've watched, share your opinions, and connect with people who
          share your taste.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Our Mission">
        <LegalParagraph>
          We believe great stories bring people together. Our mission is to create a space where
          movie and series lovers can express themselves, find their next favorite watch, and
          build meaningful connections around shared cinematic experiences.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Features">
        <LegalBullets
          items={[
            "Discover trending movies and series from across the globe",
            "Rate, review, and build your personal watchlist",
            "Follow friends and see what they're watching",
            "Use CineMatch to find users with similar taste",
            "Join community groups and chat in real time",
            "Send direct messages to fellow film lovers",
            "Get notified about activity from the people you follow",
          ]}
        />
      </LegalSection>

      <LegalSection heading="The Team">
        <LegalParagraph>
          Cinephix was created by a small and passionate team of developers who are themselves
          avid film fans. We built this platform because we wanted it to exist — and we're
          committed to keeping it growing.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Get in Touch">
        <LegalParagraph>
          Have feedback, suggestions, or just want to say hello? Reach us at{" "}
          <LegalLink href="mailto:cinephix3@gmail.com">cinephix3@gmail.com</LegalLink> or follow us
          on <LegalLink href="https://www.instagram.com/cinephixofficial/">Instagram</LegalLink>.
        </LegalParagraph>
      </LegalSection>
    </ScrollView>
  );
}
