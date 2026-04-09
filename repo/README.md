# HarborPoint

Resident & Services Management System — fully offline Angular SPA for on-site property teams.

## Quick Start (local)
```bash
npm install
npm start
```
Open **http://localhost:4200**

## Build
```bash
npm run build
```

## Test
```bash
npm run test:unit    # unit tests
npm run test:api     # integration tests
npm run test:e2e     # browser E2E tests (Playwright)
```

## Login

Enter a username and password on the login screen.

| Role | Username | Password |
|---|---|---|
| Property Administrator | admin | harborpoint2024 |
| Resident User | resident | harborpoint2024 |
| Compliance Reviewer | compliance | harborpoint2024 |
| Operations Analyst | analyst | harborpoint2024 |

Default credentials are defined in the source code (`auth.service.ts`) for deterministic QA access. Administrators may change their password via the admin-only **Settings** page; the new password is stored as an encrypted validation token in localStorage and the default is no longer accepted for that role.

## Docker

```bash
# Run the app
docker compose up --build
# Open http://localhost:4200

# Run unit + integration tests
docker compose run --build test

# Run browser E2E tests
docker compose --profile e2e up --build --abort-on-container-exit

# Stop
docker compose down
```

## Stack
Angular 17 · TypeScript · IndexedDB (Dexie.js) · Web Crypto API · Lunr.js · Chart.js · Playwright · Nginx · Docker
