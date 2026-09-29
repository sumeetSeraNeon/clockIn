# Members / Team module

Manage people in the organisation: list, invite, update, roles, deactivate.
All routes require Firebase auth; scoped by `@CurrentOrg()`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/members` | paginated; `?status=active\|deactivated` |
| POST | `/api/members/invite` | create User (`invited`) + Membership (`active`) |
| PATCH | `/api/members/:id` | `department`, `managerId`, `status` |
| POST | `/api/members/:id/roles` | `{ addRoleIds?, removeRoleIds? }` |
| DELETE | `/api/members/:id` | soft-deactivate membership (`status = deactivated`) |

### Invite behaviour

1. Creates a `users` row if the email is new (`status: invited`).
2. Creates an org `membership` (`status: active`) so they can use the API once they
   sign in with Firebase using that email (auth guard links `firebaseUid`).
3. Optional `roleIds` must belong to this organisation.
4. Optional `managerId` must be an active membership in this org.
5. Re-inviting an email already in the org → **400**.

### Safety

- You cannot deactivate your own membership (**400**).
- Deactivated memberships fail the auth guard on next request (no active membership).

## Smoke test

```powershell
npm.cmd run start:dev
node scripts/test-members.mjs owner@clockin.local sera123
```
