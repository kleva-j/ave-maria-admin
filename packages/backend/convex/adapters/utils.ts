import type { MutationCtx } from "../_generated/server";
import type { Context } from "../types";

import { DomainError } from "@avm-daily/domain";

type MutationDbMethod = "insert" | "patch" | "delete";

function getMutationDb<M extends MutationDbMethod>(
  ctx: Context,
  method: M,
  errorMessage: string,
  errorCode: string,
): Pick<MutationCtx["db"], M> {
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;
  if (typeof mutationDb[method] !== "function") {
    throw new DomainError(errorMessage, errorCode);
  }
  return mutationDb as Pick<MutationCtx["db"], M>;
}

/**
 * Validates mutation context and returns a database interface with insert capabilities.
 *
 * @param ctx - Any database context
 * @param errorMessage - Custom error message if mutation context is missing
 * @param errorCode - Custom error code for DomainError
 * @returns Database interface with insert capability
 * @throws DomainError if context is not a mutation context
 */
export function getInsertDb(
  ctx: Context,
  errorMessage: string,
  errorCode: string,
): Pick<MutationCtx["db"], "insert"> {
  return getMutationDb(ctx, "insert", errorMessage, errorCode);
}

/**
 * Validates mutation context and returns a database interface with patch capabilities.
 *
 * @param ctx - Any database context
 * @param errorMessage - Custom error message if mutation context is missing
 * @param errorCode - Custom error code for DomainError
 * @returns Database interface with patch capability
 * @throws DomainError if context is not a mutation context
 */
export function getPatchDb(
  ctx: Context,
  errorMessage: string,
  errorCode: string,
): Pick<MutationCtx["db"], "patch"> {
  return getMutationDb(ctx, "patch", errorMessage, errorCode);
}

/**
 * Validates mutation context and returns a database interface with delete capabilities.
 *
 * @param ctx - Any database context
 * @param errorMessage - Custom error message if mutation context is missing
 * @param errorCode - Custom error code for DomainError
 * @returns Database interface with delete capability
 * @throws DomainError if context is not a mutation context
 */
export function getDeleteDb(
  ctx: Context,
  errorMessage: string,
  errorCode: string,
): Pick<MutationCtx["db"], "delete"> {
  return getMutationDb(ctx, "delete", errorMessage, errorCode);
}
