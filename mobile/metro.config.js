// Expo's default Metro config, plus the debug IDs Sentry uses to match
// crash stack traces to source maps (for builds and EAS Updates alike).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
