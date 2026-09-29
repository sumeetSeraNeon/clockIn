# Tickets module

Org-scoped tickets (incidents / service requests). No hard-delete — lifecycle is
status transitions only.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tickets` | requires `clientId`, `reference`, `ticketType` |
| GET | `/api/tickets` | `?page&pageSize&clientId&status&ticketType&priority` |
| GET | `/api/tickets/:id` | 404 if missing or other org |
| PATCH | `/api/tickets/:id` | fields + status transitions |

### Status flow (forward only)

`open` → `in_progress` → `resolved` → `closed`

Illegal jumps return **400**. Moving to `resolved` sets `resolvedAt` if empty.

### Types / priorities

- `ticketType`: `incident` | `service_request`
- `priority`: `low` | `medium` | `high` | `critical`
- `reference` is unique per organisation

Optional `projectId` must belong to the same org **and** the ticket's client.

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-tickets.mjs owner@clockin.local sera123
```
