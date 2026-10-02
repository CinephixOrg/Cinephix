import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { fonts } from "../../../src/theme/typography";
import { useProfile } from "../../../src/context/ProfileContext";
import SettingsSection from "../../../src/components/settings/SettingsSection";
import SettingsRow from "../../../src/components/settings/SettingsRow";
import UnreadDot from "../../../src/components/support/UnreadDot";
import SettingsNotice from "../../../src/components/settings/SettingsNotice";
import AccountSection from "../../../src/components/settings/AccountSection";
import SecuritySection from "../../../src/components/settings/SecuritySection";
import DevToolsSection from "../../../src/components/settings/DevToolsSection";
import DangerZoneSection from "../../../src/components/settings/DangerZoneSection";
import ThemePicker from "../../../src/components/settings/ThemePicker";
import LanguageSheet, { languageLabel } from "../../../src/components/settings/LanguageSheet";
import ConfirmDialog from "../../../src/components/settings/ConfirmDialog";

// expo-router re-exports React Navigation's hooks, but the project has no
// direct @react-navigation dependency to import the event type from. This
// declares exactly the shape the guard below reads, which is better than
// `any` and doesn't add a dependency for one type.
type NavigationAction = { type: string; payload?: object; source?: string; target?: string };
type BeforeRemoveEvent = {
  preventDefault: () => void;
  data: { action: NavigationAction };
};

// Settings.
//
// The screen itself holds almost no state and fetches nothing of its own. Every
// section owns its own, which is what keeps a keystroke in the bio field
// from re-rendering the theme strip and what lets each section be read on
// its own terms.
export default function SettingsScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  const navigation = useNavigation();

  // Read from the app-wide profile cache instead of fetching on open. That
  // cache is prefetched as soon as the user signs in, so by the time
  // Settings can be reached it is almost always already there — the account
  // card renders on the first frame rather than as an empty placeholder
  // that fills in a moment later.
  const { profile, error: profileError, ensureLoaded } = useProfile();
  const [languageOpen, setLanguageOpen] = useState(false);

  // A ref, not state: the guard below only ever reads it from inside an
  // event handler, and holding it in state would re-render this screen —
  // and re-run every section's diffing — on each keystroke in the bio.
  const dirtyRef = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  // The navigation the guard intercepted, held until the user decides. Null
  // whenever the dialog is closed.
  const [pendingExit, setPendingExit] = useState<NavigationAction | null>(null);

  // Only does anything on a cold open where the cache hasn't loaded yet;
  // otherwise it is a no-op.
  useEffect(() => {
    ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intercepts leaving the screen with unsaved profile edits. `beforeRemove`
  // is the one hook that covers all three ways back happens — the header
  // arrow, the Android hardware button, and the iOS swipe gesture.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event: BeforeRemoveEvent) => {
      if (!dirtyRef.current) return;
      // Only guard going *back*. Pushing a sub-page keeps this screen
      // mounted with its edits intact, and signing out already had its own
      // confirmation — prompting again there would be a second, confusing
      // dialog on top of a decision the user just made.
      const type = event.data.action.type;
      if (type !== "GO_BACK" && type !== "POP" && type !== "POP_TO_TOP") return;

      event.preventDefault();
      setPendingExit(event.data.action);
    });
    return unsubscribe;
  }, [navigation]);

  const keepEditing = useCallback(() => setPendingExit(null), []);

  const discardChanges = useCallback(() => {
    const action = pendingExit;
    setPendingExit(null);
    // Cleared first, so re-dispatching the very action the guard just
    // blocked doesn't trip it a second time.
    dirtyRef.current = false;
    if (action) navigation.dispatch(action);
  }, [pendingExit, navigation]);

  const openLanguage = useCallback(() => setLanguageOpen(true), []);
  const closeLanguage = useCallback(() => setLanguageOpen(false), []);
  const goToActivityLog = useCallback(() => router.push("/profile/activity-log"), [router]);
  const goToAbout = useCallback(() => router.push("/profile/about"), [router]);
  const goToPrivacy = useCallback(() => router.push("/profile/privacy"), [router]);
  const goToTerms = useCallback(() => router.push("/profile/terms"), [router]);
  const goToCredits = useCallback(() => router.push("/profile/credits"), [router]);
  const goToSupport = useCallback(() => router.push("/profile/support"), [router]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        content: { padding: 18, paddingBottom: 44, gap: 22 },
        // Placeholder for the account card, only ever seen on a cold open
        // before the profile cache has loaded. Sized to roughly what lands
        // there so the page doesn't jump when it does.
        skeleton: {
          height: 268,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.base200,
        },
        footer: { alignItems: "center", gap: 5, paddingTop: 8 },
        footerText: {
          fontFamily: fonts.regular,
          fontSize: 12,
          color: colors.placeholder,
          textAlign: "center",
        },
        brand: {
          fontFamily: fonts.bold,
          fontSize: 11,
          letterSpacing: 1.1,
          color: colors.placeholder,
          opacity: 0.65,
          textAlign: "center",
        },
      }),
    [colors]
  );

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SettingsSection title={t("Account")}>
          {profile && user ? (
            <AccountSection
              // Remounts if the signed-in account changes, so the fields
              // never keep the previous user's values.
              key={user._id}
              userId={user._id}
              initialUsername={profile.username}
              initialBio={profile.bio ?? ""}
              initialAvatar={profile.profile_pic_url ?? null}
              onDirtyChange={handleDirtyChange}
            />
          ) : (
            <View style={styles.skeleton} />
          )}
        </SettingsSection>

        {!profile && profileError ? <SettingsNotice tone="error" message={profileError} /> : null}

        <SettingsSection title={t("Appearance")}>
          <ThemePicker />
          <SettingsRow
            icon="language-outline"
            label={t("Language")}
            value={languageLabel(i18n.language)}
            onPress={openLanguage}
            chevron
          />
        </SettingsSection>

        <SettingsSection
          title={t("Your data")}
          caption={t("Review what you've imported or rated, and undo it if you need to.")}
        >
          <SettingsRow
            icon="time-outline"
            label={t("Activity Log")}
            onPress={goToActivityLog}
            chevron
          />
          <SettingsRow
            icon="ban-outline"
            label={t("Blocked accounts")}
            onPress={() => router.push("/profile/blocked" as never)}
            chevron
            divider={false}
          />
        </SettingsSection>

        {user && !user.isOAuthUser ? (
          <SettingsSection title={t("Security")}>
            <SecuritySection />
          </SettingsSection>
        ) : null}

        <SettingsSection title={t("About and support")}>
          {/* Support first in this section: it's the one row people come
              looking for, and it's where an answer waits for them. */}
          <SettingsRow
            icon="chatbubbles-outline"
            label={t("Help & Feedback")}
            description={t("Report a bug, ask for a feature, get help")}
            onPress={goToSupport}
            accessory={<UnreadDot />}
            chevron
            divider={false}
          />
          <SettingsRow
            icon="information-circle-outline"
            label={t("About")}
            onPress={goToAbout}
            chevron
          />
          <SettingsRow
            icon="shield-outline"
            label={t("Privacy Policy")}
            onPress={goToPrivacy}
            chevron
          />
          <SettingsRow
            icon="document-text-outline"
            label={t("Terms of Service")}
            onPress={goToTerms}
            chevron
          />
          <SettingsRow
            icon="ribbon-outline"
            label={t("Credits")}
            onPress={goToCredits}
            chevron
          />
        </SettingsSection>

        {__DEV__ ? (
          <SettingsSection title={t("Developer")}>
            <DevToolsSection />
          </SettingsSection>
        ) : null}

        <DangerZoneSection />

        <View style={styles.footer}>
          {user?.email ? (
            <Text style={styles.footerText}>
              {t("You logged in as {{email}}", { email: user.email })}
            </Text>
          ) : null}
          {/* Computed rather than written in, so it doesn't quietly go stale. */}
          <Text style={styles.brand}>Cinephix {new Date().getFullYear()}</Text>
        </View>
      </ScrollView>

      <LanguageSheet visible={languageOpen} onClose={closeLanguage} />

      <ConfirmDialog
        visible={pendingExit !== null}
        // Radially symmetric, unlike the pencil that was here: the box is
        // centred correctly now, but a diagonal glyph still *reads* off-axis
        // inside a square plate. It is also the better warning semantic.
        icon="alert-circle-outline"
        title={t("Unsaved changes")}
        message={t("You have unsaved changes. Are you sure you want to discard them?")}
        confirmLabel={t("Discard")}
        cancelLabel={t("Keep editing")}
        danger
        onConfirm={discardChanges}
        onCancel={keepEditing}
      />
    </>
  );
}
