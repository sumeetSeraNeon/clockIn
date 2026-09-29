# Clients module — how to call & tenancy check

Template CRUD module. All routes require `Authorization: Bearer <Firebase ID token>`.
`organisationId` always comes from the auth membership (`@CurrentOrg()`).

## Endpoints

| Method | Path | Body / query |
|---|---|---|
| POST | `/api/clients` | `{ "name", "code?", "currency?", "ownerId?", "status?", "externalRef?" }` |
| GET | `/api/clients` | `?page=1&pageSize=20&status=active` |
| GET | `/api/clients/:id` | — |
| PATCH | `/api/clients/:id` | partial fields |
| DELETE | `/api/clients/:id` | soft-delete → `status = archived` |

## Quick smoke test

```powershell
# terminal A
npm.cmd run start:dev

# terminal B
node scripts/test-clients.mjs owner@clockin.local sera123
```

## Cross-org tenancy test (most important)

1. Create a client while logged in as owner (your org).
2. Call `GET /api/clients/<that-id>` → **200**.
3. Call `GET /api/clients/<random-uuid>` → **404** (same message as missing).
4. To prove another org’s row is also 404: insert a client with a *different*
   `organisation_id` in Prisma Studio / SQL, then `GET` it with your token → **404**,
   never the row.

The service always queries `where: { id, organisationId }`. Other-org and missing
are indistinguishable on purpose.
