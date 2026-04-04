import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthUserMock } = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
}));

vi.mock("../auth", () => ({
  authKit: {
    getAuthUser: getAuthUserMock,
  },
}));

import { ConvexError } from "convex/values";

import { getAuthUserId } from "../utils";
import { TABLE_NAMES } from "../shared";

describe("getAuthUserId", () => {
  beforeEach(() => {
    getAuthUserMock.mockReset();
  });

  it("returns the application user id resolved from the authenticated identity", async () => {
    getAuthUserMock.mockResolvedValue({ id: "workos_user_123" });

    const unique = vi.fn().mockResolvedValue({ _id: "user_doc_456" });
    const withIndex = vi.fn(
      (_indexName: string, _predicate: unknown) => ({ unique }),
    );
    const query = vi.fn((_tableName: string) => ({ withIndex }));
    const ctx = {
      db: {
        query,
      },
    } as any;

    await expect(getAuthUserId(ctx)).resolves.toBe("user_doc_456");
    expect(getAuthUserMock).toHaveBeenCalledWith(ctx);
    expect(query).toHaveBeenCalledWith(TABLE_NAMES.USERS);
    expect(withIndex).toHaveBeenCalledTimes(1);
    expect(withIndex.mock.calls[0]?.[0]).toBe("by_workos_id");
    const eq = vi.fn().mockReturnValue("predicate");
    const predicate = withIndex.mock.calls[0]?.[1] as
      | ((q: { eq: (field: string, value: string) => string }) => string)
      | undefined;
    expect(predicate?.({ eq } as never)).toBe("predicate");
    expect(eq).toHaveBeenCalledWith("workosId", "workos_user_123");
  });

  it('throws ConvexError("Not authenticated") when there is no auth identity', async () => {
    getAuthUserMock.mockResolvedValue(null);

    const ctx = {
      db: {
        query: vi.fn(),
      },
    } as any;

    await expect(getAuthUserId(ctx)).rejects.toEqual(
      new ConvexError("Not authenticated"),
    );
  });

  it('throws ConvexError("User not found") when the auth identity has no user record', async () => {
    getAuthUserMock.mockResolvedValue({ id: "workos_user_123" });

    const unique = vi.fn().mockResolvedValue(null);
    const withIndex = vi.fn(
      (_indexName: string, _predicate: unknown) => ({ unique }),
    );
    const query = vi.fn((_tableName: string) => ({ withIndex }));
    const ctx = {
      db: {
        query,
      },
    } as any;

    await expect(getAuthUserId(ctx)).rejects.toEqual(
      new ConvexError("User not found"),
    );
    expect(getAuthUserMock).toHaveBeenCalledWith(ctx);
    expect(query).toHaveBeenCalledWith(TABLE_NAMES.USERS);
    expect(withIndex).toHaveBeenCalledTimes(1);
    expect(withIndex.mock.calls[0]?.[0]).toBe("by_workos_id");
    const eq = vi.fn().mockReturnValue("predicate");
    const predicate = withIndex.mock.calls[0]?.[1] as
      | ((q: { eq: (field: string, value: string) => string }) => string)
      | undefined;
    expect(predicate?.({ eq } as never)).toBe("predicate");
    expect(eq).toHaveBeenCalledWith("workosId", "workos_user_123");
  });
});
