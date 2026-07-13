# Security

## Scope model (least privilege)

This app requests only the Forge and Jira scopes required by the REST endpoints it calls. All Jira mutations run via **`api.asUser()`**, so the platform enforces the **calling user's** existing Jira permissions — the app cannot escalate beyond what that user may already do in Jira.

| Scope | API / usage | Justification |
|-------|-------------|---------------|
| `storage:app` | Forge KVS (`@forge/kvs`) | Store standup entries and per-site admin settings |
| `read:jira-user` | `GET /rest/api/3/myself`, `GET /rest/api/3/user?accountId=` | Display name on submit; avatar URLs on dashboard/admin |
| `read:jira-work` | `GET /rest/api/3/project/{key}`, `GET /rest/api/3/mypermissions`, `GET /rest/api/3/search/jql` | Project validation, permission checks, issue search/linking |
| `write:jira-work` | `POST /rest/api/3/issue/{key}/transitions`, `POST /rest/api/3/issue/{key}/notify` | Optional issue status transition from standup form; notify project admins when a blocker is reported (only when enabled in settings) |
| `read:project:jira` | `GET /rest/api/3/project/{key}/role`, `GET /rest/api/3/project/{key}/role/{id}` | Resolve project members and administrators for dashboard roster |
| `manage:jira-project` | Project role actor endpoints (as user) | Read project role membership for team health and admin notifications |
| `read:board-scope:jira-software` | `GET /rest/agile/1.0/board?projectKeyOrId=` | Locate the board tied to a project for sprint summary |
| `read:sprint:jira-software` | `GET /rest/agile/1.0/board/{id}/sprint?state=active` | Active sprint date range for sprint summary |

**Write scope note:** `write:jira-work` is used only for user-initiated issue transitions and optional blocker notifications. The app does not create, edit, or delete Jira issues or comments outside those flows.

## Storage

- **Backend:** Forge KVS with scope `storage:app` (no Custom Entity, no external database).
- **Keys:** `standup:{projectKey}:{date}:{accountId}`, `app-settings:global`, `app-settings:teams`.
- **Tenant isolation:** Forge namespaces KVS per app installation — Site A cannot read Site B data.
- **Not stored:** Full Jira issue bodies, passwords, API tokens, or third-party credentials.

## Input validation

All resolver inputs are validated in `src/lib/validators.js` before processing. The frontend is not trusted — payloads could be sent via direct `invoke()` calls.

Destructive admin actions require explicit confirmation:
- **Purge all standup entries:** `confirm: 'DELETE_ALL_STANDUP_DATA'`
- **Purge one member:** valid `accountId` required

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
| Export all data | Backend checks global **`ADMINISTER`** (Jira admin) |
| Purge all / purge by member | Backend checks global **`ADMINISTER`** (Jira admin) |
| Issue search & transitions | Runs as the user (`api.asUser()`) — respects browse/transition permissions |
| Team configuration (project settings page) | Project administrator or Jira admin |

Permission checks use **`api.asUser()`** where user context matters, so Jira evaluates the **real user's project roles and global permissions**, not a default app role.

### Extending permissions

- Project-level: `userHasProjectPermission(projectKey, 'PERMISSION_KEY')` in `src/lib/permissions.js`
- Site-level: `userHasGlobalPermission('ADMINISTER')`
- Custom allow-lists: store `accountId`s in KVS settings (optional pattern; not used by default)

## Logging

Structured JSON logs via `src/lib/logger.js`:

- Includes: level, module, action, durationMs, projectKey, accountId (ID only)
- Does **not** log full standup text or secrets
- Debug logs suppressed in production

View runtime logs: `forge logs --environment {env}`

## Secrets

- No API keys or credentials stored in code
- CI/CD uses GitHub Secrets: `FORGE_EMAIL`, `FORGE_API_TOKEN`
- App runtime: Forge platform manages Jira API auth — no user OAuth tokens stored

## Pre-release checklist

- [ ] Scopes in `manifest.yml` match API usage documented above
- [ ] All resolvers validate input
- [ ] Permission checks on sensitive actions (export, purge, resolve blocker)
- [ ] No sensitive data in logs
- [ ] Admin export, per-member purge, and purge-all tested on staging
- [ ] Retention job verified via `forge logs`
- [ ] Custom UI bundles built in CI/CD (`npm run build:custom-ui`) before deploy
