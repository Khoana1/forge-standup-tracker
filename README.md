# Team Standup Tracker

Marketplace-ready Forge reference app for **Buổi 15 — AppForge Starter Kit**.

Teams log daily standups (yesterday / today / blockers) in Jira, view team history, and generate weekly summaries — with admin controls, structured logging, tests, and CI/CD.

## Features

- **Log Standup** — Submit daily updates from the project page
- **Team History** — Filter entries by date range
- **Weekly Summary** — Auto-generated team report
- **Admin pages** — General settings, team configuration, data export & purge
- **Retention** — Scheduled daily purge based on admin retention policy

## Quick start

```bash
cd forge-standup-tracker
npm install
forge login
forge deploy
forge install
```

Open a Jira project → **Team Standup Tracker** in the project sidebar.

Admin pages: **Jira settings → Apps → Team Standup Tracker**.

## Development

```bash
npm run lint
npm run test
forge tunnel
```

## Project structure

```
src/
├── lib/           # validators, logger, summary, storage helpers
├── resolvers/     # standup + admin resolver handlers
├── frontend/
│   ├── project/   # projectPage UI (3 tabs)
│   └── admin/     # 3 admin pages
└── purge-retention.js
__tests__/         # Jest unit tests
docs/              # Marketplace, security, architecture
.github/workflows/ # CI + CD
```

## Scopes

| Scope | Purpose |
|-------|---------|
| `storage:app` | Standup entries & settings |
| `read:jira-user` | User display name (`/myself`) |
| `read:jira-work` | Project validation in admin |

See [docs/SECURITY.md](docs/SECURITY.md) and [docs/MARKETPLACE.md](docs/MARKETPLACE.md).

## CI/CD secrets

Configure in GitHub:
- `FORGE_EMAIL`
- `FORGE_API_TOKEN`

## License

MIT
# forge-standup-tracker
