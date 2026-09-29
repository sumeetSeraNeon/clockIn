# Reporting module (read-only)

Aggregates **time lines** (not entries) for the caller's organisation.
Revenue = billable hours × looked-up **billable** rate (`RatesService.lookup`).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/reports/summary` | totals + groups |
| GET | `/api/reports/detailed` | paginated line-level rows |

### Summary query

- **Required:** `dateFrom`, `dateTo` (YYYY-MM-DD)
- `groupBy`: `project` (default) | `client` | `user`
- Optional filters: `clientId`, `projectId`, `userId`

Returns `totals` (minutes, hours, billable/non-billable, revenue) and `groups[]`.

### Detailed query

- **Required:** `dateFrom`, `dateTo`
- Pagination: `page`, `pageSize`
- Filters: `clientId`, `projectId`, `userId`, `taskId`, `billable`

Each row includes task/project/client/user labels, hours, billable rate, and revenue.

## Not in this pass (P2)

- CSV export
- Utilisation (working_calendar)

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-reports.mjs owner@clockin.local sera123
```
