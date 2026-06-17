# Security

## Scope model (least privilege)
This app uses scopes required by the Jira REST endpoints it calls:
- `storage:app` — Forge storage for standup entries and settings
- `read:jira-user` — `GET /rest/api/3/myself` (display name)
- `read:jira-work` — project validation, issue search, permission checks

No write scopes on Jira issues are requested.

## Input validation
All resolver inputs are validated in `src/lib/validators.js` before processing. The frontend is not trusted — payloads could be sent via direct `invoke()` calls.

## Tenant isolation
- Standup keys are scoped per installation (Forge platform enforces tenant isolation).
- Keys include `accountId` from Forge `context`, never from user-supplied payload.
- One entry per user per project per day: `{projectKey}:{date}:{accountId}`.

## Authorization

### What `accountId` is (and is not)
- **`context.accountId`** comes from Forge for the **currently logged-in user** on each resolver call.
- It is used to **identify who submitted a standup** (storage key, “my standup today”).
- It is **not** a permission system — the app does not assign roles by account ID in settings.

### How permissions work today
| Surface | Enforcement |
|---------|----------------|
| `jira:adminPage` | Forge restricts to **Jira administrators** only |
| Submit / view standup (project page, issue panel) | Any user who can open the page; entry tied to their `context.accountId` |
| Resolve blocker | Backend checks **`ADMINISTER_PROJECTS`** via `GET /rest/api/3/mypermissions` (`api.asUser()`) |
| Export / purge all data | Backend checks global **`ADMINISTER`** (Jira admin) |
| Issue search | Runs as the user (`api.asUser()`) — respects their Jira browse permissions |

Permission checks use **`api.asUser()`**, so Jira evaluates the **real user's project roles and global permissions**, not a default app role.

### Extending permissions
- Project-level: `userHasProjectPermission(projectKey, 'PERMISSION_KEY')` in `src/lib/permissions.js`
- Site-level: `userHasGlobalPermission('ADMINISTER')`
- Custom allow-lists: store `accountId`s in KVS settings (optional pattern; not used by default)

## Logging
Structured JSON logs via `src/lib/logger.js`:
- Includes: level, module, action, durationMs, projectKey, accountId (ID only)
- Does **not** log full standup text or secrets

## Secrets
- No API keys or credentials stored in code
- CI/CD uses GitHub Secrets: `FORGE_EMAIL`, `FORGE_API_TOKEN`

## Pre-release checklist
- [ ] Scopes in manifest match API usage
- [ ] All resolvers validate input
- [ ] Permission checks on sensitive actions (export, purge, resolve blocker)
- [ ] No sensitive data in logs
- [ ] Admin export/purge tested on staging
- [ ] Retention job verified via `forge logs`
