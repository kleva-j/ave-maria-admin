import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock WorkOS AuthKit
vi.mock("@workos/authkit-tanstack-react-start", () => ({
  getAuth: vi.fn(() =>
    Promise.resolve({
      user: null,
      sessionId: "test-session-id",
      organizationId: null,
      role: undefined,
      permissions: [],
    })
  ),
  getAuthorizationUrl: vi.fn(({ data }) =>
    Promise.resolve(
      `https://auth.workos.com/mock?returnPathname=${
        data?.returnPathname ?? "/"
      }`
    )
  ),
  signOut: vi.fn(() => Promise.resolve()),
  handleCallbackRoute: vi.fn(() => ({
    loader: vi.fn(),
  })),
  authkitMiddleware: vi.fn(() => vi.fn()),
}));
