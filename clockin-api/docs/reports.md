# Reports module

Approved-time rollups for hours and (with `rate:view`) money.

## Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/api/reports/summary` | `report:view` | Hours + revenue/cost/margin when `rate:view` |
| GET | `/api/reports/detailed` | `report:view` | Line-level; bill rate/revenue only if commercial |
| GET | `/api/reports/budget` | `report:view` | Budget burn + timeline % + on_track/watch/overrunning |
| GET | `/api/reports/utilisation` | `report:view` | Billable ÷ available (calendar or weekday×8) |
| GET | `/api/reports/approvals` | `report:view` | Timesheet slice pipeline |
| GET | `/api/reports/cr` | `report:view` | Change Request dashboard (ticket CRs + linked time) |

## Change Request report

Hybrid date rules:

- **Value KPIs / approval mix** — tickets with `ticketType=change_request` whose `openedAt` (else `createdAt`) falls in `dateFrom`–`dateTo`, filtered by client/project/department.
- **Aging** — still-open CRs (status not `closed` / `resolved` / `legacy_ticket`); age vs `dateTo`; same entity filters; **not** opened-date boxed.
- **Hours / rate profit** — approved time lines in range on CR tickets. Person filter scopes time only (not value KPIs).

Commercial (`rate:view`): `crValue` rollups, revenue/cost/margin by person & department (same rate rules as Summary), and per-CR sold value vs cost. Managers see counts and hours only.

## STEP 3 money rules

- **Revenue** = approved **billable** hours × billable rate (lookup priority unchanged).
- **Cost** = approved hours (billable + non-billable) × cost rate.
- **Margin** = revenue − cost; **margin %** = margin ÷ revenue × 100.
- Commercial fields only when the caller has `rate:view` (admin/owner). Managers see hours + utilisation + budget burn, never revenue/cost/margin.

## Budget burn signals

Compare `budgetBurnPct` (actual ÷ budget) to `timelineElapsedPct` (start→end as of `dateTo`):

| Signal | Rule |
|---|---|
| `on_track` | burn ≤ timeline + 10pp |
| `watch` | burn leads timeline by 10–25pp |
| `overrunning` | burn leads by >25pp **or** actual > budget |
| `unknown` | missing budget and/or project dates |

## Utilisation

Primary metric: `billableUtilisationPct` = billable minutes ÷ available minutes.
Available hours from `working_calendar` (user then org default); else Mon–Fri × 8h.
