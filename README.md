# avm-daily

A modern full-stack TypeScript application built with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), featuring React, TanStack Start, Convex, WorkOS AuthKit, and more.

## Features

### Core Technologies

- **TypeScript** - Full-stack type safety
- **TanStack Start** - SSR React framework with file-based routing
- **TanStack Router** - Type-safe client-side routing
- **TanStack Query** - Server state management with React Query
- **TanStack Forms** - Form handling with Zod validation
- **Convex** - Reactive backend-as-a-service with real-time subscriptions
- **React Native + Expo** - Cross-platform mobile development
- **TailwindCSS v4** - Utility-first CSS framework

### Authentication & Security

- **WorkOS AuthKit** - Enterprise authentication with OAuth support
  - Email/password authentication
  - Magic link authentication
  - SSO/SAML support
  - Session management
- **Protected Routes** - Route guards with auth validation
- **Return URL Handling** - Safe redirect after authentication

### UI Components

- **shadcn/ui** - Accessible component primitives
- **Shared UI Package** - Reusable components in `packages/ui`
- **Login Page** - Custom login with AuthKit integration
- **Field Components** - Form field composition with validation states

## Project Structure

```
avm-daily/
├── apps/
│   ├── web/                    # React web application (TanStack Start)
│   │   ├── src/
│   │   │   ├── components/     # Web-specific components
│   │   │   ├── routes/         # TanStack Router pages
│   │   │   │   ├── login.tsx      # Login page with AuthKit
│   │   │   │   ├── _protected/   # Protected route group
│   │   │   │   └── ...
│   │   │   ├── lib/            # Utilities (auth.ts)
│   │   │   └── ...
│   │   └── components.json     # shadcn configuration
│   └── native/                 # React Native/Expo mobile app
├── packages/
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── components/     # shadcn primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── field.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   └── ...
│   │   │   ├── styles/         # Global CSS with CSS variables
│   │   │   └── lib/           # Utilities (cn, utils)
│   │   └── components.json    # shadcn configuration
│   └── backend/               # Convex backend
│       └── ...                # Functions, schema, migrations
```

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm 8.x or higher
- Convex account (free tier available)
- WorkOS account (for AuthKit)

### Installation

```bash
# Install dependencies
pnpm install
```

### Environment Setup

1. **Convex Setup**

```bash
pnpm run dev:setup
```

Follow the prompts to create a Convex project and connect it to your application.

2. **WorkOS AuthKit Setup**

Create a WorkOS account at [workos.com](https://workos.com) and get your credentials from the dashboard.

Add the following environment variables to `apps/web/.env`:

```env
WORKOS_CLIENT_ID=your_client_id
WORKOS_API_KEY=your_api_key
```

Ensure your WorkOS dashboard has the redirect URI:
```
http://localhost:3001/api/auth/callback
```

3. **Copy environment variables**

```bash
cp packages/backend/.env.local apps/web/.env
cp packages/backend/.env.local apps/native/.env
cp packages/backend/.env.local apps/server/.env
```

### Running the Application

```bash
# Start all applications
pnpm run dev

# Or start individually:
pnpm run dev:web     # Web app on http://localhost:3001
pnpm run dev:native  # Expo app
```

## Authentication

### Login Page

The login page (`apps/web/src/routes/login.tsx`) provides:

- **AuthKit Sign In** - Redirect to WorkOS for OAuth authentication
- **AuthKit Sign Up** - User registration via AuthKit
- **Mode Switching** - Toggle between sign in/sign up via URL params (`?mode=signup`)
- **Return URL** - Safe redirect after authentication using `getSafeReturnPathname`

### Protected Routes

Protected routes are defined in `_protected.tsx`:

```typescript
// apps/web/src/routes/_protected.tsx
export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    const auth = await getAuth();
    if (!auth.user) {
      throw redirect({
        to: "/login",
        search: { returnTo: location.pathname },
      });
    }
    return { user: auth.user };
  },
  component: ProtectedLayout,
});
```

### Auth Utilities

Located in `apps/web/src/lib/auth.ts`:

- `getSafeReturnPathname()` - Validates and sanitizes return URLs
- `DEFAULT_RETURN_PATH` - Fallback after login

## UI Components

### Adding shadcn Components

```bash
# Add to shared UI package
npx shadcn@latest add button card input -c packages/ui

# Add to web app
npx shadcn@latest add dialog sheet -c apps/web
```

### Available Components

The project includes these shadcn/ui components:

| Component    | Description                    |
|--------------|--------------------------------|
| Button       | Button with variants           |
| Card         | Card layout composition       |
| Input        | Form input                    |
| Field        | Form field with labels        |
| FieldGroup   | Group form fields             |
| FieldLabel   | Field label                   |
| FieldDescription | Field helper text          |
| Label        | HTML label wrapper            |
| Checkbox     | Checkbox input                |
| DropdownMenu | Dropdown menu                 |
| Skeleton     | Loading placeholder           |
| Sonner       | Toast notifications           |
| Badge        | Status badge                  |

### Customizing Styles

- **Global styles**: `packages/ui/src/styles/globals.css`
- **Tailwind config**: Uses CSS variables in globals.css
- **shadcn style**: Configured in `apps/web/components.json`

## Forms with TanStack Forms

The login page demonstrates TanStack Forms with Zod validation:

```typescript
import { zodValidator } from "@tanstack/zod-form-adapter";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const form = useForm({
  defaultValues: { email: "", password: "" },
  validatorAdapter: zodValidator(),
  validators: { onChange: loginSchema },
  onSubmit: async ({ value }) => { /* ... */ },
});
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start all applications |
| `pnpm run build` | Build all applications |
| `pnpm run dev:web` | Start web app only |
| `pnpm run dev:native` | Start Expo app |
| `pnpm run dev:setup` | Setup Convex project |
| `pnpm run check-types` | TypeScript type checking |
| `pnpm run check` | Run Oxlint and Oxfmt |

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

See [TESTING.md](apps/web/TESTING.md) for detailed testing documentation.

## API Routes

The application uses TanStack Start's file-based routing:

| Route | Description |
|-------|-------------|
| `/` | Home page |
| `/login` | Login page with AuthKit |
| `/todos` | Todo list (protected) |
| `/dashboard` | Dashboard (protected) |
| `/api/auth/callback` | WorkOS auth callback |

## Dependencies

Key packages used in this project:

- `@tanstack/react-start` - Full-stack React framework
- `@tanstack/react-router` - Type-safe routing
- `@tanstack/react-query` - Server state
- `@tanstack/react-form` - Form handling
- `@workos/authkit-tanstack-react-start` - AuthKit integration
- `convex` - Backend platform
- `@base-ui/react` - UI primitives (shadcn)
- `shadcn` - Component registry
- `zod` - Schema validation
- `lucide-react` - Icons
