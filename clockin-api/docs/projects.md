# Projects module

Copy of the Clients CRUD template. Parent ownership: `clientId` must belong to
the caller's organisation.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/projects` | requires `clientId` (+ name, optional code/owner/dates/budgets) |
| GET | `/api/projects` | `?page&pageSize&status&clientId` |
| GET | `/api/projects/:id` | 404 if missing or other org |
| PATCH | `/api/projects/:id` | partial update |
| DELETE | `/api/projects/:id` | soft-delete → `archived` |

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-projects.mjs owner@clockin.local sera123
```
