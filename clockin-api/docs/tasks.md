# Tasks module

Copy of the Clients/Projects CRUD template. Parent ownership: `projectId` must
belong to the caller's organisation. Optional `assigneeId` must be an active
membership in the same org.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tasks` | requires `projectId` + `name` |
| GET | `/api/tasks` | `?page&pageSize&status&projectId&assigneeId` |
| GET | `/api/tasks/:id` | 404 if missing or other org |
| PATCH | `/api/tasks/:id` | reassign, mark done, etc. |
| DELETE | `/api/tasks/:id` | soft-delete → `archived` |

Statuses: `open` | `done` | `archived`

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-tasks.mjs owner@clockin.local sera123
```
