# frontend

HarborPoint is a fully offline Angular 17 single-page application for on-site property management teams. It enables administrators, residents, compliance reviewers, and operations analysts to manage buildings, units, residents, documents, messaging, enrollment, and analytics — all running in the browser with data persisted in IndexedDB using AES-GCM encryption.

## Architecture and Tech Stack

- **Framework**: Angular 17 (standalone components, lazy-loaded feature modules)
- **Data layer**: IndexedDB via Dexie.js with Web Crypto API (AES-GCM, PBKDF2)
- **Search**: Lunr.js full-text search with synonym expansion
- **Charts**: Chart.js (analytics dashboard)
- **Styling**: SCSS with CSS custom properties, Angular Material
- **Serving**: Nginx (SPA routing with `try_files` fallback)
- **Testing**: Jest (unit), Playwright (E2E, headless Chromium)
- **Containerisation**: Docker multi-stage build, Docker Compose

## Project Structure

```
repo/
├── src/
│   ├── app/
│   │   ├── app.component.ts          # Root shell with sidebar navigation
│   │   ├── app-routing.module.ts     # All 13 routes with role guards
│   │   ├── core/
│   │   │   ├── services/             # AuthService, DbService, CryptoService, …
│   │   │   └── guards/               # AdminGuard, ResidentGuard, ComplianceGuard, …
│   │   ├── features/
│   │   │   ├── login/                # Login form (RolePickerComponent)
│   │   │   ├── dashboard/            # Admin overview dashboard
│   │   │   ├── residents/            # Resident list, drawer, add-modal, my-profile
│   │   │   ├── property/             # Buildings, units, rooms management
│   │   │   ├── documents/            # Document queue and approval workflow
│   │   │   ├── messaging/            # Message threads and announcements
│   │   │   ├── search/               # Full-text search (Lunr.js)
│   │   │   ├── enrollment/           # Course enrollment and waitlists
│   │   │   ├── analytics/            # Reporting charts (Chart.js)
│   │   │   ├── audit/                # Append-only audit log viewer
│   │   │   ├── settings/             # Admin settings (password change, policies)
│   │   │   └── unauthorized/         # Fallback for forbidden routes
│   │   └── shared/
│   │       ├── components/           # Table, Drawer, Modal, Badge, StatCard, …
│   │       └── pipes/                # MaskPipe (PII redaction)
│   └── styles.scss                   # Global theme variables
├── tests/
│   ├── unit_tests/                   # Jest unit tests
│   │   ├── services/                 # One spec per service
│   │   ├── components/               # Component and guard specs
│   │   ├── guards/                   # Route guard specs
│   │   └── pipes/                    # MaskPipe spec
│   └── e2e/                          # Playwright end-to-end tests (headless)
├── Dockerfile                        # Multi-stage: Node build → Nginx serve
├── Dockerfile.test                   # Jest unit test runner
├── Dockerfile.e2e                    # Playwright E2E runner
├── docker-compose.yml                # app / test / e2e services
├── jest.config.js                    # Jest configuration
├── playwright.config.ts              # Playwright configuration (headless)
└── run_tests.sh                      # Docker-based test runner
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- Docker Compose (included with Docker Desktop)

No local Node.js or npm installation is required.

## Running the Application

```bash
docker compose up --build
```

```bash
docker-compose up --build
```

Open **http://localhost:4200** in your browser.

To stop:

```bash
docker compose down
```

## Testing

All tests run inside Docker — no local Node.js required.

```bash
./run_tests.sh
```

This script:
1. Runs all Jest unit tests via Docker
2. Starts the app container and runs Playwright E2E tests in headless mode via Docker
3. Exits with code `0` if every suite passes, non-zero if any fail

To run suites individually:

```bash
# Unit tests only
docker compose --profile test run --rm test

# E2E tests only (starts app automatically)
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e
docker compose --profile e2e down
```

## Seeded Credentials

On first launch the database is seeded with the following accounts:

| Role | Username | Password |
|---|---|---|
| Property Administrator | admin | harborpoint2024 |
| Resident User | resident | harborpoint2024 |
| Compliance Reviewer | compliance | harborpoint2024 |
| Operations Analyst | analyst | harborpoint2024 |

Administrators may change their password via the **Settings** page. The new password is stored as an encrypted validation token in `localStorage`; the default password is no longer accepted for that role after a change.
