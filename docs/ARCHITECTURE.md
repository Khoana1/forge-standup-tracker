# Architecture

## Overview
Marketplace-ready Forge app (UI Kit) for daily standup tracking in Jira.

```
┌─────────────────────────────────────────────────────────────┐
│  Jira UI (UI Kit)                                           │
│  ├── jira:projectPage (log / history / summary)             │
│  └── jira:adminPage × 3 (settings / team / data)            │
└───────────────────────────┬─────────────────────────────────┘
                            │ invoke()
┌───────────────────────────▼─────────────────────────────────┐
│  Resolver (src/resolvers/)                                  │
│  ├── standup.js — submit, history, weekly summary             │
│  └── admin.js — settings, export, purge                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  Custom Entity        KVS settings      Jira REST API
  standup-entry        global + team     project / myself
```

## Modules

| Module | Purpose |
|--------|---------|
| `jira:projectPage` | User-facing standup workflow (3 sub-pages) |
| `jira:adminPage` × 3 | General settings, team config, data & privacy |
| `scheduledTrigger` | Daily retention purge |
| `function/resolver` | Backend API for all UI modules |

## Storage

### Custom Entity: `standup-entry`
Indexed by `by-project-date` and `by-user-date` for efficient team queries.

### KVS keys
- `app-settings:global` — enabled, retentionDays, timezone
- `app-settings:teams` — enabledProjects[]
- `standup-entry-registry` — index of entity keys for export/purge

## Environments
`development` → `staging` → `production`

Deploy:
```bash
forge deploy --environment staging
forge install --upgrade --environment staging
```

## CI/CD
- **CI** (`.github/workflows/ci.yml`): lint + Jest on PR/push
- **CD** (`.github/workflows/cd.yml`): deploy staging on push; production via manual workflow dispatch
