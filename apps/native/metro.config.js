const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withUniwindConfig } = require("uniwind/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

// getSentryExpoConfig is a drop-in replacement for expo/metro-config's
// getDefaultConfig — it registers Sentry's source-map serializer so the
// SDK can map minified stack traces back to original sources during EAS
// builds. No-op for runtime; upload only happens when SENTRY_AUTH_TOKEN
// is set at build time.
/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const uniwindConfig = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});

module.exports = uniwindConfig;
