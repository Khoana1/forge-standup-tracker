# Team Standup Tracker — Marketplace Listing Draft

## App name
**Team Standup Tracker**

## Tagline
Log daily standups in Jira, review team history, and generate weekly summaries.

## Category
Productivity · Agile · Team collaboration

## Short description
Team Standup Tracker lets agile teams record yesterday / today / blockers updates inside Jira projects, browse team standup history, and export weekly summaries — with admin controls for retention, project scope, and data privacy.

## Key features
- Daily standup form on the Jira project page
- Team history table with date range filter
- Weekly summary generator (Markdown-style text)
- Admin: global settings, team/project configuration, data export & purge
- Automated retention purge (scheduled trigger)

## Permissions justification

| Scope | Why it is required |
|-------|-------------------|
| `storage:app` | Store standup entries and admin settings (Forge Custom Entity + KVS) |
| `read:jira-user` | `GET /rest/api/3/myself` — current user's display name |
| `read:jira-work` | `GET /rest/api/3/project/{key}` — validate project keys in admin config |

## Data handling
- **Stored:** account ID, display name, project key, date, standup text, timestamps
- **Not stored:** Issue content, passwords, or third-party credentials
- **Retention:** Configurable 7–365 days; daily scheduled purge
- **Export / delete:** Available to Jira admins via Data & Privacy admin page

## Support
- Documentation: see `README.md` and `docs/ARCHITECTURE.md`
- Security: see `docs/SECURITY.md`

## Screenshots (capture after deploy)
1. Log Standup tab — form with three fields
2. Team History tab — DynamicTable with entries
3. Weekly Summary tab — generated summary
4. Admin — General Settings
5. Admin — Data & Privacy export
