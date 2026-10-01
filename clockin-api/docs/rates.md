# Rates module

Effective-dated **cost** and **billable** rates. History is append-only: never
overwrite a row — insert a new one with a new `effectiveFrom`. Creating a new
open-ended rate for the same identity closes the previous open row’s
`effectiveTo` (day before).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/rates` | `?rateType&scope&clientId&projectId&userId&taskId&current&page&pageSize` |
| POST | `/api/rates` | create only (Decimal `amount`) |
| POST | `/api/rates/pair` | STEP 2 — cost + billable for `project_user` in one call |
| GET | `/api/rates/project-user` | STEP 2 — `?projectId` (& optional `userId`) current cost/bill/margin |
| POST | `/api/rates/lookup` | most-specific rate for a date + context |

### Scopes & required ids

| scope | required fields |
|---|---|
| `organisation` | none |
| `client` | `clientId` |
| `project` | `projectId` |
| `user` | `userId` |
| `task` | `taskId` |
| `project_user` | `projectId` + `userId` |

### Lookup priority (highest first)

`task` → `project_user` → `project` → `client` → `user` → `organisation`

Date must satisfy: `effectiveFrom <= date` and (`effectiveTo` is null or `>= date`).

### STEP 2 pair body

```json
{
  "projectId": "…",
  "userId": "…",
  "costAmount": 75,
  "billableAmount": 125,
  "currency": "GBP",
  "effectiveFrom": "2026-01-01"
}
```

Returns both rate rows plus `marginAmount` / `marginPercent`
(margin % = (bill − cost) / bill × 100).

Cost rates stay behind `rate:view` / `rate:edit` (admin/owner). Members and PMs
without those grants never see cost.

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-rates.mjs owner@clockin.local sera123
```
