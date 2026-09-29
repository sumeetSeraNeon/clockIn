# Time module (entries + lines)

Core of ClockIn. An **entry** is a block of time for a user on a date. A **line**
is one activity inside that entry (duration, task, billable, etc.). Reporting
and billing use lines.

All routes require Firebase auth. Entries are scoped to the **caller's user**
inside the organisation (`organisationId` from `@CurrentOrg()`).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/time-entries` | create entry + mandatory first `line` |
| GET | `/api/time-entries` | caller's entries; `?dateFrom&dateTo&page&pageSize` |
| GET | `/api/time-entries/:id` | entry + lines |
| PATCH | `/api/time-entries/:id/stop` | set `endTime` on a running timer |
| POST | `/api/time-entries/:id/lines` | add another line |
| PATCH | `/api/time-lines/:id` | edit a line |
| DELETE | `/api/time-lines/:id` | remove a line (not the last one) |

## Rules enforced

- Every entry has ≥ 1 line; first line has `isFirstLine: true`
- `durationMinutes` must be ≥ 1
- If `ticketType = 'cr'`, both `crId` and `crNumber` are required (and `crId` must be in-org)
- Timer: `source=timer`, `endTime=null` until stop
- Stop sets `endTime` only; duration stays on lines, not on the entry
- Deleting the last line → **400**; deleting the first line promotes another

## Create body example

```json
{
  "entryDate": "2026-09-22",
  "source": "timer",
  "line": {
    "taskId": "<uuid>",
    "durationMinutes": 15,
    "billable": true,
    "area": "technical"
  }
}
```

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-time.mjs owner@clockin.local sera123
```
