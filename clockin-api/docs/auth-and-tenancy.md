# Auth & tenancy — how modules must use organisationId

Phase 1 ClockIn is internal and single-organisation, but every tenant-owned table
still has `organisationId`. Treat tenancy as sacred from day one.

## Request flow

1. Client sends `Authorization: Bearer <Firebase ID token>`.
2. `FirebaseAuthGuard` verifies the token, resolves our `users` row, loads an
   **active** `membership` (with roles), and sets on the request:
   - `request.user`
   - `request.membership`
   - `request.organisationId` ← from membership only
3. Controllers / services read org scope via `@CurrentOrg()` or
   `requireOrganisationId(...)`.

## How a future module should query

```ts
@UseGuards(FirebaseAuthGuard)
@Get()
list(@CurrentOrg() organisationId: string) {
  return this.prisma.client.findMany({
    where: { organisationId }, // ALWAYS include this
  });
}
```

Or in a service:

```ts
const organisationId = requireOrganisationId(request.organisationId);
await this.prisma.project.findMany({ where: { organisationId } });
```

## Never do this

- Do **not** take `organisationId` from body, params, or query.
- Do **not** run tenant queries without an org filter “because Phase 1 has one org”.
- Do **not** auto-create users on login in Phase 1 — seed or invite first.

## Decorators

| Decorator | Provides |
|---|---|
| `@CurrentUser()` | ClockIn `users` row |
| `@CurrentMembership()` | Active membership + `roles[]` |
| `@CurrentOrg()` | `organisationId` string (throws if missing) |

Public routes (e.g. `GET /api/health`) omit `FirebaseAuthGuard`.
