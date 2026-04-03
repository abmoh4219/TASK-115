# HarborPoint

Resident & Services Management System — fully offline Angular SPA for on-site property teams.

## Run
```bash
docker compose up --build
```
Open **http://localhost:4200**

## Test
```bash
docker compose run --build test
```

## Stop
```bash
docker compose down
```

## Login

Enter a username and password on the login screen.

| Role | Username | Password |
|---|---|---|
| Property Administrator | admin | harborpoint2024 |
| Resident User | resident | harborpoint2024 |
| Compliance Reviewer | compliance | harborpoint2024 |
| Operations Analyst | analyst | harborpoint2024 |

Credentials are listed in the README only — they do not appear anywhere in the application UI.

## Stack
Angular 17 · TypeScript · IndexedDB (Dexie.js) · Web Crypto API · Lunr.js · Chart.js · Nginx · Docker
