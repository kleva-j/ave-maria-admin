import type { MutationCtx } from "../_generated/server";
import type { Context } from "../types";

import { DomainError } from "@avm-daily/domain";

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
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;
  if (typeof mutationDb.insert !== "function") {
    throw new DomainError(errorMessage, errorCode);
  }
  return mutationDb as Pick<MutationCtx["db"], "insert">;
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
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;
  if (typeof mutationDb.patch !== "function") {
    throw new DomainError(errorMessage, errorCode);
  }
  return mutationDb as Pick<MutationCtx["db"], "patch">;
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
  const mutationDb = ctx.db as Partial<MutationCtx["db"]>;
  if (typeof mutationDb.delete !== "function") {
    throw new DomainError(errorMessage, errorCode);
  }
  return mutationDb as Pick<MutationCtx["db"], "delete">;
}
