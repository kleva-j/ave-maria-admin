import "@testing-library/react-native";

/**
 * Global Jest setup for the native app. jest-expo already registers most of
 * the Expo module mocks we need — this file exists as a home for any repo-
 * specific mocks that land in future PRs (Reanimated, Convex, PostHog).
 */

// Silence noisy warnings from RN's animated helper when tests mount screens
// that use Reanimated shared values.
jest.mock("react-native/Libraries/LogBox/LogBox", () => ({
  ignoreLogs: jest.fn(),
  ignoreAllLogs: jest.fn(),
}));

// PostHog RN — every consumer expects a client to exist; return a stub so
// component tests don't need a live PostHog init.
jest.mock("posthog-react-native", () => ({
  usePostHog: () => ({
    isFeatureEnabled: () => undefined,
    onFeatureFlags: () => () => {},
  }),
  PostHogProvider: ({ children }: { children: unknown }) => children,
}));

// Convex — component-level tests treat all hooks as loading (undefined).
jest.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => async () => {},
  useConvex: () => ({}),
  ConvexProviderWithAuth: ({ children }: { children: unknown }) => children,
  ConvexReactClient: class {},
}));
