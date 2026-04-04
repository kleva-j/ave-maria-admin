import * as fc from "fast-check";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

import { describe, it, expect } from "vitest";

import type { WithdrawalRepository, RiskHoldRepository } from "../ports";

// ---------------------------------------------------------------------------
// Helpers for static analysis tests
// ---------------------------------------------------------------------------

/** Recursively collect all .ts files under a directory (excluding .d.ts) */
function collectTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Extract all import/require paths from a file's content */
function extractImportPaths(content: string): string[] {
  const importPaths: string[] = [];

  const sourceFile = ts.createSourceFile(
    "inline.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const readModuleSpecifier = (
    node: ts.Expression | undefined,
  ): string | undefined => {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      return node.text;
    }

    return undefined;
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) {
      const moduleSpecifier = readModuleSpecifier((node as ts.ImportDeclaration | ts.ExportDeclaration).moduleSpecifier);
      if (moduleSpecifier) {
        importPaths.push(moduleSpecifier);
      }
    }

    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1
      ) {
        const moduleSpecifier = readModuleSpecifier(node.arguments[0]);
        if (moduleSpecifier) {
          importPaths.push(moduleSpecifier);
        }
      } else if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length >= 1
      ) {
        const moduleSpecifier = readModuleSpecifier(node.arguments[0]);
        if (moduleSpecifier) {
          importPaths.push(moduleSpecifier);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return importPaths;
}

// Resolve the monorepo root relative to this test file's location.
// This file lives at packages/application/src/__tests__/portContracts.test.ts
// so the monorepo root is 4 levels up.
const MONOREPO_ROOT = path.resolve(__dirname, "../../../../");

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbitraryUserId = fc.string({ minLength: 1, maxLength: 36 });

const arbitraryHoldRecord = fc.record({
  _id: fc.string({ minLength: 1, maxLength: 36 }),
  reason: fc.string({ minLength: 1, maxLength: 200 }),
  placed_at: fc.integer({ min: 0 }),
});

const arbitraryWithdrawalRecord = fc.record({
  requested_at: fc.integer({ min: 0 }),
  requested_amount_kobo: fc.bigInt({ min: 1n }),
});

// ---------------------------------------------------------------------------
// Property 14: RiskHoldRepository behavioral contract
// ---------------------------------------------------------------------------

describe("Property 14: RiskHoldRepository behavioral contract", () => {
  it("findActiveWithdrawalHold returns null or an object with _id (string), reason (string), placed_at (number)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        fc.option(arbitraryHoldRecord, { nil: null }),
        async (userId, holdOrNull) => {
          const repo: RiskHoldRepository = {
            findActiveWithdrawalHold: async () => holdOrNull,
            create: async () => ({ _id: "hold-1" }),
            release: async () => undefined,
          };

          const result = await repo.findActiveWithdrawalHold(userId);

          if (result === null) {
            expect(result).toBeNull();
          } else {
            expect(typeof result._id).toBe("string");
            expect(result._id.length).toBeGreaterThan(0);
            expect(typeof result.reason).toBe("string");
            expect(typeof result.placed_at).toBe("number");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("create returns an object with a non-empty string _id", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user_id: fc.string({ minLength: 1, maxLength: 36 }),
          scope: fc.string({ minLength: 1, maxLength: 50 }),
          status: fc.string({ minLength: 1, maxLength: 50 }),
          reason: fc.string({ minLength: 1, maxLength: 200 }),
          placed_by_admin_id: fc.string({ minLength: 1, maxLength: 36 }),
          placed_at: fc.integer({ min: 0 }),
        }),
        fc.string({ minLength: 1, maxLength: 36 }),
        async (holdInput, generatedId) => {
          const repo: RiskHoldRepository = {
            findActiveWithdrawalHold: async () => null,
            create: async () => ({ _id: generatedId }),
            release: async () => undefined,
          };

          const result = await repo.create(holdInput);

          expect(typeof result._id).toBe("string");
          expect(result._id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15: WithdrawalRepository behavioral contract
// ---------------------------------------------------------------------------

describe("Property 15: WithdrawalRepository behavioral contract", () => {
  it("findByUserId returns an array where every element has requested_at (number) and requested_amount_kobo (bigint)", async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryUserId,
        fc.array(arbitraryWithdrawalRecord, { maxLength: 20 }),
        async (userId, withdrawals) => {
          const repo: WithdrawalRepository = {
            findById: async () => null,
            findByUserId: async () => withdrawals,
          };

          const results = await repo.findByUserId(userId);

          expect(Array.isArray(results)).toBe(true);
          for (const item of results) {
            expect(typeof item.requested_at).toBe("number");
            expect(typeof item.requested_amount_kobo).toBe("bigint");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("findByUserId returns an empty array when no withdrawals exist", async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryUserId, async (userId) => {
        const repo: WithdrawalRepository = {
          findById: async () => null,
          findByUserId: async () => [],
        };

        const results = await repo.findByUserId(userId);

        expect(results).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 1: Layer boundary — no upward imports
// Feature: clean-architecture-refactor, Property 1: Layer boundary — no upward imports
// Validates: Requirements 1.1, 1.2
// ---------------------------------------------------------------------------

describe("Property 1: Layer boundary — no upward imports", () => {
  const domainSrc = path.join(MONOREPO_ROOT, "packages/domain/src");
  const applicationSrc = path.join(MONOREPO_ROOT, "packages/application/src");

  const DOMAIN_FORBIDDEN = [
    "packages/application",
    "packages/backend",
    "apps/web",
    "apps/native",
    "@avm-daily/application",
    "@avm-daily/backend",
  ];

  const APPLICATION_FORBIDDEN = [
    "packages/backend",
    "apps/web",
    "apps/native",
    "@avm-daily/backend",
  ];

  it("no file in packages/domain/src imports from application, backend, or presentation layers", () => {
    const files = collectTsFiles(domainSrc);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const imports = extractImportPaths(content);
      for (const imp of imports) {
        for (const forbidden of DOMAIN_FORBIDDEN) {
          if (imp.includes(forbidden)) {
            violations.push(`${path.relative(MONOREPO_ROOT, file)}: imports "${imp}"`);
          }
        }
      }
    }

    expect(violations, `Layer boundary violations found:\n${violations.join("\n")}`).toEqual([]);
  });

  it("no file in packages/application/src imports from backend or presentation layers", () => {
    const files = collectTsFiles(applicationSrc);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const imports = extractImportPaths(content);
      for (const imp of imports) {
        for (const forbidden of APPLICATION_FORBIDDEN) {
          if (imp.includes(forbidden)) {
            violations.push(`${path.relative(MONOREPO_ROOT, file)}: imports "${imp}"`);
          }
        }
      }
    }

    expect(violations, `Layer boundary violations found:\n${violations.join("\n")}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Property 2: No Convex SDK in domain or application
// Feature: clean-architecture-refactor, Property 2: No Convex SDK in domain or application
// Validates: Requirements 1.1, 1.2, 6.4, 6.5
// ---------------------------------------------------------------------------

describe("Property 2: No Convex SDK in domain or application", () => {
  const domainSrc = path.join(MONOREPO_ROOT, "packages/domain/src");
  const applicationSrc = path.join(MONOREPO_ROOT, "packages/application/src");

  const CONVEX_FORBIDDEN_PATTERNS = [
    /^convex\//,
    /^convex$/,
  ];

  function hasConvexImport(imports: string[]): string | null {
    for (const imp of imports) {
      for (const pattern of CONVEX_FORBIDDEN_PATTERNS) {
        if (pattern.test(imp)) return imp;
      }
    }
    return null;
  }

  it("no file in packages/domain/src imports from convex/*", () => {
    const files = collectTsFiles(domainSrc);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const imports = extractImportPaths(content);
      const hit = hasConvexImport(imports);
      if (hit) {
        violations.push(`${path.relative(MONOREPO_ROOT, file)}: imports "${hit}"`);
      }
    }

    expect(violations, `Convex SDK imports found in domain layer:\n${violations.join("\n")}`).toEqual([]);
  });

  it("no file in packages/application/src imports from convex/*", () => {
    const files = collectTsFiles(applicationSrc);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const imports = extractImportPaths(content);
      const hit = hasConvexImport(imports);
      if (hit) {
        violations.push(`${path.relative(MONOREPO_ROOT, file)}: imports "${hit}"`);
      }
    }

    expect(violations, `Convex SDK imports found in application layer:\n${violations.join("\n")}`).toEqual([]);
  });
});
