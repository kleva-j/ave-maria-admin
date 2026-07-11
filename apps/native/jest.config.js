module.exports = {
  preset: "jest-expo",
  setupFilesAfterEach: ["<rootDir>/jest-setup.ts"],
  setupFiles: ["<rootDir>/jest-setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-reanimated|react-native-safe-area-context|@shopify/.*|@sentry/.*|@novu/.*|posthog-react-native|convex|@avm-daily/.*|uniwind))",
  ],
  testMatch: ["<rootDir>/**/__tests__/**/*.test.(ts|tsx)"],
};
