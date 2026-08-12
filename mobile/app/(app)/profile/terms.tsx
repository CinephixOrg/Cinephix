import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { LegalTitle, LegalUpdated, LegalSection, LegalParagraph, LegalBullets, LegalLink } from "../../../src/components/LegalPage";
import { useTheme } from "../../../src/context/ThemeContext";

export default function TermsOfServiceScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create({ container: { padding: 20, backgroundColor: colors.base100, flexGrow: 1 } }),
    [colors]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LegalTitle>Terms of Service</LegalTitle>
      <LegalUpdated>Last updated: May 2025</LegalUpdated>

      <LegalSection heading="1. Acceptance of Terms">
        <LegalParagraph>
          By creating an account or using Cinephix, you agree to be bound by these Terms of
          Service. If you do not agree to these terms, please do not use the platform.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <LegalParagraph>
          You must be at least 13 years old to use Cinephix. By using the platform, you confirm
          that you meet this age requirement. If you are under 18, you should have parental
          consent before registering.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. Your Account">
        <LegalParagraph>
          You are responsible for maintaining the security of your account credentials. Do not
          share your password with others. You are responsible for all activity that occurs
          under your account. Notify us immediately at{" "}
          <LegalLink href="mailto:cinephix3@gmail.com">cinephix3@gmail.com</LegalLink> if you
          suspect unauthorized access.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Acceptable Use">
        <LegalParagraph>When using Cinephix, you agree not to:</LegalParagraph>
        <LegalBullets
          items={[
            "Post content that is abusive, hateful, harassing, or discriminatory",
            "Impersonate other users or public figures",
            "Spam, flood, or otherwise disrupt community spaces",
            "Attempt to access accounts, systems, or data that are not yours",
            "Upload malware or any code designed to harm the platform or its users",
            "Use the platform for any unlawful purpose",
          ]}
        />
      </LegalSection>

      <LegalSection heading="5. User Content">
        <LegalParagraph>
          You retain ownership of the content you post on Cinephix (reviews, ratings,
          messages, etc.). By posting, you grant Cinephix a non-exclusive, royalty-free license
          to display and distribute that content on the platform. You are solely responsible
          for ensuring that your content does not infringe the rights of any third party.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Intellectual Property">
        <LegalParagraph>
          The Cinephix name, logo, and platform design are the property of the Cinephix team.
          You may not copy, reproduce, or distribute any part of the platform without explicit
          written permission.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Termination">
        <LegalParagraph>
          We reserve the right to suspend or terminate accounts that violate these Terms of
          Service, without prior notice. You may delete your account at any time through the
          Settings page.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Disclaimer of Warranties">
        <LegalParagraph>
          Cinephix is provided "as is" without warranties of any kind. We do not guarantee
          uninterrupted or error-free operation of the platform. We are not liable for any
          loss of data or damages arising from your use of the service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Changes to Terms">
        <LegalParagraph>
          We may revise these Terms at any time. Continued use of Cinephix after changes
          are posted means you accept the revised terms. We will notify you of significant
          changes via the platform or email.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <LegalParagraph>
          Questions about these Terms? Reach us at{" "}
          <LegalLink href="mailto:cinephix3@gmail.com">cinephix3@gmail.com</LegalLink>.
        </LegalParagraph>
      </LegalSection>
    </ScrollView>
  );
}
