# Team Sync (Standup Tracker) — Marketplace Listing Draft

## App name
**Team Sync** (internal package: `forge-standup-tracker`)

## Tagline
Log daily standups in Jira, review team history, and generate sprint summaries.

## Category
Productivity · Agile · Team collaboration

## Short description
Team Sync lets agile teams record yesterday / today / blockers updates inside Jira projects, browse team standup history, view a team dashboard, and export sprint summaries — with admin controls for retention, project scope, and data privacy.

## Key features

- **Project page** (4 views): team dashboard, daily standup log, team history, sprint summary
- **Issue panel:** standup from issue context with issue linking
- **Admin (×3):** general settings (`useAsConfig`), team/project configuration (`useAsGetStarted`), data & privacy
- **Project settings page:** team/project allowlist for project admins
- **Blocker workflow:** resolve blockers; optional admin notification on new/changed blockers
- **Data privacy:** Excel (.xlsx) auto-download, per-member delete, purge all standup entries
- **Automated retention purge** (daily scheduled trigger)

## UI stack

| Surface | Technology |
|---------|------------|
| Project page | Custom UI (static bundle) |
| Issue panel, admin pages | Forge UI Kit (`render: native`) |

## Permissions justification

| Scope | Why it is required |
|-------|-------------------|
| `storage:app` | Store standup entries and admin settings in Forge KVS |
| `read:jira-user` | `GET /rest/api/3/myself` and user profile — display name and avatars |
| `read:jira-work` | Project validation, issue search, permission checks (`mypermissions`) |
| `write:jira-work` | Issue status transitions from standup (user-initiated); optional blocker notify to project admins |
| `read:project:jira` | Project role membership — team roster on dashboard |
| `manage:jira-project` | Read project role actors for team health and notifications |
| `read:board-scope:jira-software` | Find Jira board for a project |
| `read:sprint:jira-software` | Active sprint dates for sprint summary view |

All Jira write operations run as the **current user** (`api.asUser()`). The app cannot perform actions the user is not already allowed to perform in Jira.

## Data handling

- **Stored in Forge KVS (`storage:app`):** account ID, display name, project key, date, standup text (yesterday/today/blockers), timestamps, linked issue keys, blocker resolution metadata, admin settings
- **Not stored:** Full Jira issue content, passwords, or third-party credentials
- **Retention:** Configurable 7–365 days; daily scheduled purge (`purge-retention` function)
- **Export:** Jira admins — Excel `.xlsx` file downloads automatically via Data & Privacy / Dashboard
- **Delete:** Jira admins — per-member purge or purge all standup entries (settings/team config retained)
- **Multi-site:** One Forge app ID; each installation is tenant-isolated by the platform

## Support

- Documentation: see `README.md` and `docs/ARCHITECTURE.md`
- Security: see `docs/SECURITY.md`

## Screenshots (capture after deploy)

1. Project page — Team Sync hôm nay (standup form)
2. Project page — Lịch sử team (history table)
3. Project page — Tổng kết sprint (sprint summary)
4. Project page — Tổng quan team (dashboard)
5. Issue panel — standup with linked issues
6. Admin — General Settings
7. Admin — Team Configuration
8. Admin — Data & Privacy (export + delete)
