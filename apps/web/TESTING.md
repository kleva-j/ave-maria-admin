# Testing Guide

This project uses [Vitest](https://vitest.dev) for testing, configured with TanStack Start and React Testing Library.

## Quick Start

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test -- --coverage
```

## Configuration

### Vitest Config (`vitest.config.ts`)
- **Environment**: jsdom (for DOM testing)
- **Test Files**: `src/**/*.{test,spec}.{ts,tsx}`
- **Setup File**: `src/test-setup.ts`
- **Coverage**: V8 provider with HTML/JSON/Text reporters

### TypeScript Config
- Added `vitest/globals` to types for global test functions
- Path aliases (`@/*`) work in tests via `vite-tsconfig-paths`

## Test Structure

### Component Tests

Example: [`src/components/loader.test.tsx`](src/components/loader.test.tsx)

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Loader from "@/components/loader";

describe("Loader Component", () => {
  it("should render loader with correct structure", () => {
    const { container } = render(<Loader />);
    
    expect(container.firstChild).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("should have the correct CSS classes", () => {
    const { container } = render(<Loader />);
    const wrapper = container.firstChild as HTMLElement;
    
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("h-full");
  });
});
```

### Server Function Tests

For testing server functions created with `createServerFn`:

```typescript
import { describe, it, expect } from "vitest";
import { getCurrentUser } from "@/server/auth.functions";

describe("getCurrentUser", () => {
  it("should be defined", () => {
    expect(getCurrentUser).toBeDefined();
  });
  
  // Integration tests would require mocking the middleware context
});
```

### Middleware Tests

```typescript
import { describe, it, expect } from "vitest";
import { authMiddleware } from "@/middleware/auth";

describe("authMiddleware", () => {
  it("should be defined", () => {
    expect(authMiddleware).toBeDefined();
  });
  
  it("should be a function", () => {
    expect(typeof authMiddleware).toBe("function");
  });
});
```

## Test Utilities

### Mock Helpers ([`src/lib/test-helpers.ts`](src/lib/test-helpers.ts))

#### Auth Mocks
```typescript
import { authMocks } from "@/lib/test-helpers";

// Create mock auth context
const mockContext = authMocks.createMockContext({
  auth: {
    user: { id: "123", email: "test@example.com" },
    sessionId: "session-456",
    organizationId: "org-789",
    role: "admin",
    permissions: ["read", "write"],
  },
});
```

#### Server Function Helpers
```typescript
import { serverFnHelpers } from "@/lib/test-helpers";

// Execute handler with mock context
const result = await serverFnHelpers.executeWithMockContext(
  getCurrentUser.handler,
  mockContext,
);

// Execute handler with POST data
const result = await serverFnHelpers.executeWithPostData(
  someMutation.handler,
  { data: "value" },
);
```

#### Mock Builder
```typescript
import { createMockBuilder } from "@/lib/test-helpers";

const builder = createMockBuilder();
const mockFn = builder.fn("myMock", () => "result");

// Later...
builder.reset();   // Reset mocks
builder.clear();   // Clear call history
builder.restore(); // Restore original implementations
```

## Mocking

### Global Mocks ([`src/test-setup.ts`](src/test-setup.ts))

The following modules are automatically mocked:

- `@workos/authkit-tanstack-react-start` - AuthKit methods return mock data
- Console methods are preserved (not mocked)

### Custom Mocks

```typescript
import { vi } from "vitest";

// Mock a module
vi.mock("@/module", () => ({
  functionName: vi.fn(() => "mocked result"),
}));

// Mock implementation in test
const mockFn = vi.fn();
mockFn.mockImplementation(() => "new result");
mockFn.mockResolvedValue({ data: "value" });
```

## Best Practices

### 1. Test Behavior, Not Implementation
```typescript
// ✅ Good
expect(result.userId).toBe("123");

// ❌ Avoid testing internal implementation details
```

### 2. Use Descriptive Test Names
```typescript
// ✅ Good
it("should return null when user is not authenticated");

// ❌ Vague
it("should work");
```

### 3. Arrange-Act-Assert Pattern
```typescript
it("should do something", () => {
  // Arrange
  const input = { value: "test" };
  
  // Act
  const result = functionUnderTest(input);
  
  // Assert
  expect(result).toEqual(expected);
});
```

### 4. Clean Up Between Tests
- Use `beforeEach` and `afterEach` hooks
- Clear mocks: `vi.clearAllMocks()`
- Reset implementations: `vi.resetAllMocks()`

### 5. Async Testing
```typescript
// Async/await
it("should fetch data", async () => {
  const data = await fetchData();
  expect(data).toBeTruthy();
});

// Promise return
it("should resolve", () => {
  return promise.then(result => {
    expect(result).toBe("value");
  });
});
```

## Writing New Tests

### Step 1: Create Test File
Create `*.test.ts` or `*.test.tsx` next to the file being tested.

### Step 2: Import Dependencies
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
```

### Step 3: Setup Mocks (if needed)
```typescript
vi.mock("@/module", () => ({
  // mock implementation
}));
```

### Step 4: Write Test Cases
```typescript
describe("ComponentName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do something", () => {
    // test code
  });
});
```

### Step 5: Run Tests
```bash
pnpm test path/to/test.test.tsx
```

## Debugging Tests

### Run Specific Test
```bash
# By file
pnpm vitest run src/components/loader.test.tsx

# By pattern
pnpm vitest run -t "should render"
```

### Watch Mode
```bash
pnpm vitest
```

### Verbose Output
```bash
pnpm vitest --reporter=verbose
```

## Coverage

Generate coverage report:
```bash
pnpm test -- --coverage
```

View HTML report:
```bash
open coverage/index.html
```

## Common Issues

### "Cannot find module"
- Ensure you're using ES6 imports, not `require()`
- Check path aliases are correct
- Verify the file exists

### "Property 'toBeInTheDocument' does not exist"
- Don't use jest-dom matchers (not installed)
- Use standard assertions: `toBeTruthy()`, `toContain()`, etc.

### SVG/Icon Queries
```typescript
// Use querySelector for SVGs
const icon = container.querySelector("svg");
expect(icon).toBeTruthy();

// Or use hidden option
const icon = screen.getByRole("img", { hidden: true });
```

### TanStack Start Server Functions
Server functions require special handling due to middleware. For now:
- Test that they're defined
- Integration testing requires additional setup

## Next Steps

Consider adding:
- More component test examples
- Integration tests for routes/loaders
- E2E tests with Playwright
- Snapshot testing for components
- Performance tests

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [TanStack Start Testing](https://tanstack.com/start)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing)
