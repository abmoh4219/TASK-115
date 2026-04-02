# HarborPoint — Resident & Services Management System

A fully offline, browser-only Angular 17+ SPA for on-site property management.
All data lives in IndexedDB and LocalStorage — no backend, no server, no Docker required.

---

## How to Run

```bash
npm install
npm start
# Access at http://localhost:4200
```

---

## Default Test Credentials (local only)

| Role | Username | Password |
|---|---|---|
| Admin | admin | harborpoint2024 |
| Resident | resident | harborpoint2024 |
| Compliance | compliance | harborpoint2024 |
| Analyst | analyst | harborpoint2024 |

---

## How to Run Tests

```bash
chmod +x run_tests.sh
./run_tests.sh
```

Or individually:

```bash
npm run test:unit    # Unit tests with coverage
npm run test:api     # Integration tests
```

---

## Project Structure

```
src/app/
├── core/
│   ├── services/        # All business logic (db, auth, crypto, audit, ...)
│   └── guards/          # Role-based route guards (admin, resident, compliance, analyst)
├── shared/
│   ├── components/      # Reusable UI (table, drawer, modal, badge, toast)
│   └── pipes/           # mask.pipe — redacts phone/email in templates
└── features/            # Feature modules (property, residents, documents, ...)

unit_tests/              # Jest unit tests
api_tests/               # Integration tests
run_tests.sh             # One-click test runner
```

---

## Architecture Decisions

| Concern | Solution |
|---|---|
| **Storage** | IndexedDB via Dexie.js (structured data) + LocalStorage (settings/preferences only) |
| **Crypto** | Web Crypto API: AES-GCM 256-bit encryption, PBKDF2 100k iterations |
| **Auth** | In-memory session only — role NEVER persisted to localStorage for guard checks |
| **Audit** | Append-only `auditLogs` table — no update or delete ever called |
| **Masking** | `maskSensitiveContent()` applied to ALL message bodies before display/storage |
| **Guards** | Role checks in Angular guards and service methods — NEVER in templates |
| **Testing** | Jest (not Karma) with `fake-indexeddb` for offline IndexedDB in Node |

---

## How to Import/Export Data

**Settings → Import/Export → Enter password → Select file**

- Export creates an encrypted `.hpd` file using AES-GCM
- Import requires the same password used for export
- Schema validation and duplicate-key handling performed on import

---

## Verification Checklist

1. Log in as **Admin** → Create a building → Add a unit → Add a room
2. Log in as **Resident** → Fill profile → Upload a document → Register for a course
3. Log in as **Compliance** → Review the document queue → Approve/Reject
4. Log in as **Analyst** → View the analytics dashboard

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| **Phase 1** | ✅ Complete | Scaffolding, core services, guards, routing, app shell, unit tests |
| Phase 2 | Planned | Property CRUD, Resident profiles, move-in/out |
| Phase 3 | Planned | Document workflow, Compliance queue |
| Phase 4 | Planned | Messaging, Announcements, Templates |
| Phase 5 | Planned | Search, Enrollment, Analytics |
| Phase 6 | Planned | Anomaly detection, Import/Export, Audit viewer |
