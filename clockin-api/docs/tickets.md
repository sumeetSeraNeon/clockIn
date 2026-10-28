# Tickets module

Org-scoped tickets (Freshdesk-shaped: incidents, changes, service requests, etc.).
No hard-delete — status is set freely among the allowed list. Excel import
creates or updates by Ticket ID (`reference`).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/tickets` | requires `clientId`, `reference`, `ticketType` |
| GET | `/api/tickets` | `?page&pageSize&clientId&projectId&departmentId&status&ticketType&priority&q` |
| GET | `/api/tickets/departments` | active departments for Group dropdown (`ticket:view`) |
| GET | `/api/tickets/:id` | detail + approved minutes + submitted/approved time lines |
| PATCH | `/api/tickets/:id` | fields + any allowed status |
| POST | `/api/imports/tickets/preview` | Freshdesk Excel row preview (`ticket:edit`) |
| POST | `/api/imports/tickets/commit` | create / update by reference |

### Types

`incident` | `change` | `question` | `service_request` | `problem`

### Statuses (agent labels)

`open` | `pending` | `resolved` | `closed` | `waiting_on_customer` |
`waiting_on_third_party` | `legacy_ticket` | `ready_for_prod_deploy` |
`assigned_to_ai_agent`

Any status may be set. Moving to `resolved` / `closed` fills timestamps if empty.

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
