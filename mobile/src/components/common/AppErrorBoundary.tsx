import { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import i18next from "../../i18n";
import Pressable from "./TapSafePressable";
import { PALETTES, DEFAULT_THEME } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

// The last line of defence: a render error anywhere below the root layout
// would otherwise close a release build outright. Shows a calm fallback
// with a way back in instead.
//
// Sits outside every provider, so it can't rely on any of them: colours
// come from the default palette (the theme itself may be what failed), and
// text from i18next directly, which falls back to the English key.

type Props = {
  children: ReactNode;
  /** Told about every error caught here (crash reporting). */
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { error: Error | null };

const colors = PALETTES[DEFAULT_THEME];

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error);
    this.props.onError?.(error, info);
  }

  // Remounts everything below from scratch; the providers reload their own state.
  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Cinephix</Text>
        <Text style={styles.message}>{i18next.t("Something went wrong. Please try again.")}</Text>
        <Pressable style={styles.button} onPress={this.retry} accessibilityRole="button">
          <Text style={styles.buttonText}>{i18next.t("Try again")}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: colors.base100,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.extrabold,
    color: colors.baseContent,
    marginBottom: 12,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.baseContent,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primaryContent,
  },
});
