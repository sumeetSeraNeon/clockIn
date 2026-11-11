# Tickets module

Org-scoped tickets (Freshdesk-shaped: incidents, change requests, service
requests, etc.). No hard-delete — status is set freely among the allowed list.
Excel import creates or updates by Ticket ID (`reference`).

**Change Request** is a ticket with `ticketType = change_request`. The ticket
`reference` is the CR number. Commercial fields (`crApprovalStatus`, `crValue`,
`crValueCurrency`) apply only to that type. `crValue` is owner/admin only.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tickets` | requires `clientId`, `projectId`, `reference`, `ticketType` |
| GET | `/api/tickets` | `?page&pageSize&clientId&projectId&departmentId&status&ticketType&priority&q` |
| GET | `/api/tickets/departments` | active departments for Group dropdown (`ticket:view`) |
| GET | `/api/tickets/:idOrReference` | UUID or human `reference`; detail + time rollups |
| PATCH | `/api/tickets/:idOrReference` | cannot clear `projectId` (always required) |
| POST | `/api/imports/tickets/preview` | Freshdesk Excel row preview (`ticket:edit`) |
| POST | `/api/imports/tickets/commit` | create / update by reference |

### Types

`incident` | `change_request` | `question` | `service_request` | `problem`

Import still accepts legacy labels `Change` / `change` → stores `change_request`.

### Statuses (agent labels)

`open` | `pending` | `resolved` | `closed` | `waiting_on_customer` |
`waiting_on_third_party` | `legacy_ticket` | `ready_for_prod_deploy` |
`assigned_to_ai_agent`

Any status may be set. Moving to `resolved` / `closed` fills timestamps if empty.

### Change Request approval (`crApprovalStatus`)

`pending` | `approved` | `hold` | `rejected` | `in_delivery`

Required when `ticketType = change_request` (defaults to `pending` on create).

### Priorities

- `priority`: `low` | `medium` | `high` | `critical` (Urgent → critical)
- `ticketPriority`: `p1` | `p2` | `p3` | `p4`

### Groups (= Departments)

Freshdesk **Group** is a ClockIn **Department**. Tickets store `departmentId`.
Import matches Group by department name (case-insensitive). Missing department →
preview/commit **error** for that row (departments are not auto-created from the ticket file).

### Import

Client must already exist (matched by Client column, or Tags if Client blank).
Ticket ID → `reference`. Re-import updates. Project is left empty unless already set.
Group must match an existing department when present.
`ticket_attachments` exists in the schema for future image upload; no upload API yet.
