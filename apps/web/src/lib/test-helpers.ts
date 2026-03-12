import type { Mock } from "vitest";

import { vi } from "vitest";

/**
 * Auth mock utilities for testing
 */
export const authMocks = {
  /**
   * Create a mock auth object for server functions
   */
  createMockAuth(overrides?: Partial<{
    user: { id: string; email?: string } | null;
    sessionId: string;
    organizationId: string | null;
    role: string | undefined;
    permissions: string[];
  }>) {
    return {
      user: null,
      sessionId: "test-session-id",
      organizationId: null,
      role: undefined,
      permissions: [],
      ...overrides,
    };
  },

  /**
   * Create a mock authenticated user context
   */
  createMockContext(overrides?: Partial<{
    auth: {
      user: { id: string; email?: string };
      sessionId: string;
      organizationId?: string | null;
      role?: string;
      permissions?: string[];
    };
  }>) {
    return {
      auth: {
        user: { id: "test-user-id", email: "test@example.com" },
        sessionId: "test-session-id",
        organizationId: null,
        role: "user",
        permissions: [],
        ...overrides?.auth,
      },
    };
  },
};

/**
 * Server function test utilities
 */
export const serverFnHelpers = {
  /**
   * Execute a server function with mock context
   * @example
   * const result = await executeWithMockContext(getSessionFn.handler, {
   *   auth: { user: { id: "123", email: "test@example.com" } }
   * });
   */
  async executeWithMockContext<T, C extends Record<string, unknown> = Record<string, never>>(
    handler: (params: { context: C }) => Promise<T>,
    contextOverrides?: Partial<C>,
  ): Promise<T> {
    const context = {
      ...authMocks.createMockContext(),
      ...contextOverrides,
    } as C;

    return handler({ context });
  },

  /**
   * Execute a server function with POST data
   * @example
   * const result = await executeWithPostData(serverFn.handler, {
   *   token: "123456",
   *   secret: "secret"
   * });
   */
  async executeWithPostData<T, D extends Record<string, unknown> = Record<string, never>>(
    handler: (params: { data: D; context?: unknown }) => Promise<T>,
    data: D,
    context?: unknown,
  ): Promise<T> {
    return handler({ data, context });
  },
};

/**
 * Mock builder for creating complex test scenarios
 */
export class MockBuilder {
  private mocks: Map<string, Mock> = new Map();

  /**
   * Create a mock function
   */
  fn(name: string, implementation?: (...args: unknown[]) => unknown) {
    const mock = vi.fn(implementation);
    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Get a mock by name
   */
  get(name: string) {
    return this.mocks.get(name);
  }

  /**
   * Reset all mocks
   */
  reset() {
    for (const mock of this.mocks.values()) {
      mock.mockReset();
    }
  }

  /**
   * Restore all mocks
   */
  restore() {
    for (const mock of this.mocks.values()) {
      mock.mockRestore();
    }
  }

  /**
   * Clear all mock calls
   */
  clear() {
    for (const mock of this.mocks.values()) {
      mock.mockClear();
    }
  }
}

/**
 * Create a mock builder instance
 */
export function createMockBuilder() {
  return new MockBuilder();
}

/**
 * Wait for async operations with timeout
 */
export async function waitForAsync(
  callback: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();

  while (true) {
    const result = await callback();
    if (result) return;

    if (Date.now() - startTime > timeout) {
      throw new Error(`waitForAsync timed out after ${timeout}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
