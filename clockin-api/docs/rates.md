# Rates module

Effective-dated **cost** and **billable** rates. History is append-only: never
overwrite a row — insert a new one with a new `effectiveFrom`. Creating a new
open-ended rate for the same identity closes the previous open row’s
`effectiveTo` (day before).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/rates` | `?rateType&scope&clientId&projectId&userId&taskId&page&pageSize` |
| POST | `/api/rates` | create only (Decimal `amount`) |
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

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-rates.mjs owner@clockin.local sera123
```
