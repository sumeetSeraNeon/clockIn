# Cross-cutting (authz, audit, errors, pagination)

Shared foundations used by every domain module.

## Permissions

- Auth loads role **permissions** onto `request.membership.permissions`.
- `@RequirePermission('resource', 'action')` + `PermissionsGuard` enforce on sensitive routes.
- Routes without the decorator stay auth + org-scoped only.
- `GET /api/me` returns `permissions[]`.

| Resource | Action | Applied to |
|---|---|---|
| `client` | `edit` | `DELETE /clients/:id` |
| `project` | `edit` | `DELETE /projects/:id` |
| `task` | `edit` | `DELETE /tasks/:id` |
| `membership` | `edit` | invite / update / roles / deactivate |
| `rate` | `view` | list + lookup |
| `rate` | `edit` | create |
| `report` | `view` | summary + detailed |
| `time_entry` | `edit` | create/stop/add/edit/delete time |

Seed: **owner** has the matrix above; **employee** only `time_entry:edit`.

## Audit

`AuditService.writeAudit(...)` (global). Mutating modules already call it on create/update/archive.

## Errors

Global `HttpExceptionFilter` returns:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Missing permission report:view",
  "path": "/api/reports/summary?...",
  "timestamp": "..."
}
```

## Pagination

`src/common/pagination.ts` — used by every list endpoint.

## Seed extras

Ticket `INC-1001`, org billable/cost rates, sample employee time entry + line.

## Smoke test

```powershell
npx.cmd prisma db seed
npm.cmd run start:dev
node scripts/test-cross-cutting.mjs owner@clockin.local sera123
```
