# Frontend structure

Each feature owns its components, hooks, services, validation, and contracts:

```text
src/
  app/                    Next.js pages, layouts, and API route handlers
  features/
    auth/                 Login, registration, password reset, session cleanup
    account/              Profile, avatar, and password changes
    catalog/              Products, categories, filters, checkout price reads
    contact/              Contact form
    orders/               Checkout, order actions, and the existing draft store
    home/                 Home page sections
  components/
    ui/                   Shared Button, fields, icons, and other controls
    layout/               Header, footer, and navigation
    i18n/                 Shared language components
    brand/                Branding
  shared/
    http/                 Browser/server transports, origin checks, responses
    query-provider.tsx    TanStack Query client and provider
    config/               Environment configuration
    lib/                  Shared type guards
  lib/                    Shared money formatting
  i18n/                   Locale configuration and translated navigation
tests/                    Storefront regressions, service contracts, boundaries
```

## Request flow

For browser interactions:

```text
UI component -> form/action hook -> TanStack mutation hook -> feature service
             -> shared browser transport -> existing Next.js API route
             -> server feature service -> Express
```

Form hooks own the existing validation, draft state, messages, and redirects.
Services own endpoint strings and request payloads. Components render the form
and call hook handlers. HTTP result unions preserve the existing status and
message handling; expected API failures are not converted to exceptions.

Server Components continue to read through `.server.ts` services. This preserves
server rendering, request-scoped session verification, metadata, pagination,
and existing redirects. Client hooks never import server services. Catalog
contracts are in `features/catalog/types.ts` and can be imported by either side.

The query provider uses a new client per server request and a stable client in
the browser. Automatic retries and window-focus/reconnect refetching are disabled
to preserve existing request behavior. Checkout's product hook uses
`queryClient.fetchQuery` while retaining the existing all-at-once price refresh
and cancellation behavior. Keys include user ID and product ID.
Order writes keep the original idempotency key; uncertain submissions remain
retryable through the existing checkout controls. Sensitive mutation entries
are discarded when no longer active.

## Filters

Typing does not apply filters. Apply submits the same GET parameters, with
repeated submissions debounced by 300 ms in the catalog filter hook. Clear
cancels a pending submission. Server normalization, validation, sorting, and
pagination are unchanged. Debouncing reduces requests; it does not suppress
the rendering needed for user input.

## Environment

Copy `.env.example` to `.env.local` and restart the dev server after changing
public environment variables:

```dotenv
API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_ORDER_WHATSAPP_NUMBER=201015981398
```

`API_URL` is the server-only Express base URL, including its common prefix.
Browser services use the application's same-origin `/api` routes. This prefix
is centralized in `shared/http/request.ts`; it is not a deployment setting.
Public variables must not contain credentials.

Services specify only a relative endpoint, for example `auth/login` or
`orders/${id}/cancel`. Shared transports join it with the appropriate base.
The private Express URL and Bearer token stay on the server.

Existing environments using `API_URL=http://localhost:4000` must include
`/api/v1` after this reorganization. Local `.env.local` has been migrated.
The WhatsApp number is the same checkout destination, now configurable.

## Shared helpers

`features/auth/lib/session.ts` groups token-shape checks, expiry calculations,
issued-session parsing, and safe login redirects. `cookies.ts` stays separate
because it uses server-only Next.js APIs. The actual token verification remains
in Express.

Request headers and URL joining live in `shared/http/request.ts`; mutation
origin checks live beside HTTP responses in `shared/http/response.ts`. Shared
messages are imported directly from `shared/validation.ts`. Navigation entries
live beside localized navigation in `i18n/navigation.ts`.

The small `shared/lib/guards.ts` remains because many feature parsers reuse its
`isRecord` type guard. TanStack Query's provider is required by the feature hooks;
its setup is consolidated into `shared/query-provider.tsx`.

## Checks

```powershell
pnpm --filter @cosmetics/web typecheck
pnpm --filter @cosmetics/web lint
pnpm --filter @cosmetics/web test
pnpm --filter @cosmetics/web build
```

Tests cover the existing money, profile, authentication, and order-draft rules;
service URLs, methods, headers, payloads and errors; filter serialization;
query isolation and retry policy; and service/hook/UI boundaries.

## Validation

`src/shared/validation.ts` owns Zod schemas, validation limits, message keys,
and error mapping. Arabic and English text live under `validation` in
`messages/ar.json` and `messages/en.json`. Schemas receive `t` so their errors
are translated when validation runs:

```tsx
import { useTranslations } from "next-intl";
import { createValidation } from "@/shared/validation";
import { useLoginForm } from "@/features/auth/hooks/use-login-form";

function LoginForm({ nextPath }: { nextPath: string }) {
  const t = useTranslations("validation");
  const validation = createValidation(t);
  const schema = validation.auth.login();
  const { onSubmit } = useLoginForm({ nextPath, schema });

  return <form onSubmit={onSubmit}>{/* Form fields */}</form>;
}
```

Components construct their localized schema and pass it to their form hook.
Hooks call `createValidation().parse(schema, input)` and expose field errors for
the shared controls. Schemas are grouped under `auth`, `account`, `contact`,
`orders`, and `catalog`; `newsletter()` builds the newsletter schema. Shared
builders, limits, and messages are accessible through the same factory.
The small validator adapters under feature `lib/` reuse these schemas for
existing route handlers and tests. API routes use `createValidation()` without a translator to
preserve their English response contract; known API messages are translated
when displayed in the UI. Contact, newsletter, registration, and password
change retain their distinct original validation rules.

## Error handling

`shared/errors.ts` owns API message extraction and the common error decisions.
`shared/use-error-handler.ts` owns inline error state, clearing, reporting, and
optional expired-session navigation. Expected HTTP failures retain their status
and message. Unexpected exceptions use the existing public fallback.

Feature hooks opt into redirects and conflict refresh only where their workflow
requires them:

Inside a feature hook, call `useErrorHandler()` to get `error`, `clearError`,
`reportError`, and `handleError`. Clear the previous error before submitting.
On an unsuccessful result, call
`handleError(result, { loginPath: "/login?expired=1" })` when that operation
should navigate on an expired session. Render `<ErrorMessage message={error} />`
inside the form. Operations such as login omit `loginPath` and keep failures inline.

`components/ui/error-message.tsx` renders field and form errors with shared
translation and announcement behavior. Pass the existing `id` for field
descriptions, `announce={false}` for errors that previously had no alert role,
and `translate={false}` for text already translated by the caller. Existing
spacing and colors are retained through `className`.

The page error boundaries reuse `components/ui/error-state.tsx`. The root
boundary uses the English dictionary without requiring a locale provider.

Feature-specific behavior stays explicit: wrong-current-password errors remain
inline, profile uploads retain partial-save handling, logout keeps its
unconfirmed-revocation flow, and checkout keeps its existing idempotency and
uncertain-submit rules. There are no automatic retries or global error toasts.
