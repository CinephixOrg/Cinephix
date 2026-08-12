import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { LegalTitle, LegalUpdated, LegalSection, LegalParagraph, LegalBullets, LegalLink } from "../../../src/components/LegalPage";
import { useTheme } from "../../../src/context/ThemeContext";

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create({ container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 } }),
    [colors]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalTitle>Privacy Policy</LegalTitle>
      <LegalUpdated>Last updated: May 2025</LegalUpdated>

      <LegalSection heading="1. Introduction">
        <LegalParagraph>
          Welcome to Cinephix. We respect your privacy and are committed to protecting the
          personal information you share with us. This Privacy Policy explains what data we
          collect, how we use it, and the choices you have regarding your information.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Information We Collect">
        <LegalParagraph>We collect information you provide directly, including:</LegalParagraph>
        <LegalBullets
          items={[
            "Account details such as your username and email address when you register",
            "Profile information you choose to add (profile picture, bio)",
            "Content you create — reviews, ratings, watchlist entries, and messages",
            "Activity on the platform such as follows, likes, and community participation",
          ]}
        />
        <LegalParagraph>
          We also automatically collect limited technical data such as your browser type and
          general usage patterns to help us improve the platform.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. How We Use Your Information">
        <LegalBullets
          items={[
            "To create and manage your account",
            "To provide and personalize platform features (e.g., CineMatch recommendations)",
            "To send notifications relevant to your activity",
            "To improve and debug the platform",
            "To communicate with you about important updates",
          ]}
        />
        <LegalParagraph>We do not sell your personal data to third parties.</LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Data Sharing">
        <LegalParagraph>
          Cinephix does not share your personal information with third parties except where
          necessary to operate the service (e.g., hosting providers) or where required by law.
          Content you post publicly — such as reviews and ratings — may be visible to other users.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Data Security">
        <LegalParagraph>
          We take reasonable technical and organizational measures to protect your data from
          unauthorized access, loss, or misuse. Passwords are stored using industry-standard
          hashing algorithms and are never stored in plain text.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Your Rights">
        <LegalParagraph>You have the right to:</LegalParagraph>
        <LegalBullets
          items={[
            "Access the personal data we hold about you",
            "Request correction of inaccurate data",
            "Request deletion of your account and associated data",
            "Withdraw consent at any time by closing your account",
          ]}
        />
        <LegalParagraph>
          To exercise any of these rights, contact us at{" "}
          <LegalLink href="mailto:cinephix3@gmail.com">cinephix3@gmail.com</LegalLink>.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Cookies">
        <LegalParagraph>
          Cinephix uses minimal cookies and local storage to keep you logged in and to remember
          your preferences. We do not use cookies for advertising or cross-site tracking.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Changes to This Policy">
        <LegalParagraph>
          We may update this Privacy Policy from time to time. Significant changes will be
          communicated via the platform or by email. Continued use of Cinephix after changes
          are posted constitutes your acceptance of the updated policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Contact">
        <LegalParagraph>
          If you have any questions about this Privacy Policy, please contact us at{" "}
          <LegalLink href="mailto:cinephix3@gmail.com">cinephix3@gmail.com</LegalLink>.
        </LegalParagraph>
      </LegalSection>
    </ScrollView>
  );
}
