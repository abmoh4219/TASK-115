# questions.md — HarborPoint Business Logic Questions Log

> These are clarifying questions raised during Prompt analysis. Each entry states the ambiguity,
> my working assumption, and the solution implemented.

---

## 1. Password & Key Derivation — Session vs. Persistent

**Question:** The Prompt says AES-GCM key is derived from a "local password" via PBKDF2. Does the user enter this password every time they open the app, or is there a persistent session?

**My Understanding:** The app must prompt for the encryption password on first load (or after a timeout). Since there is no backend session, the derived key lives in memory only for the duration of the session. Closing the tab clears it.

**Solution:** On app init, if IndexedDB contains encrypted data, a password prompt modal appears before the main UI loads. The derived key is stored in a service-level variable (not LocalStorage/IndexedDB). After 30 minutes of inactivity, the session auto-locks and prompts again.

---

## 2. Role Selection — How Does a User Pick Their Role?

**Question:** The Prompt describes 4 roles but gives no login/authentication mechanism. Since there is no backend auth, how does role assignment work?

**My Understanding:** This is an offline, on-site tool. Roles are selected at login (a local role-picker screen with a password per role, or a single password with stored role preference). The Prompt does not specify multi-user isolation — it may be used by one person wearing different hats.

**Solution:** A role-selection screen is shown after password entry. The selected role determines the Angular route guard context. `LocalStorage` stores the `last_active_role` for UX convenience but never for security enforcement. All guard checks re-read from the active in-memory auth state.

---

## 3. Occupancy — Can a Resident Be Inactive and Still Have a Room?

**Question:** The Prompt says "only one active occupancy per resident is allowed." If a resident's status changes to `inactive`, should their room occupancy be automatically ended?

**My Understanding:** Move-out is an explicit action requiring a reason code and timestamp. Changing a resident's status to `inactive` alone should not silently end occupancy — that would be implicit behavior.

**Solution:** Changing `resident.status` to `inactive` triggers a validation warning: "This resident has an active room assignment. Would you like to end their occupancy?" Admin must confirm the move-out separately with a reason code. The two operations are logged as separate audit entries.

---

## 4. Document Consent Revocation — Is the File Deleted from Storage?

**Question:** "Residents can revoke consent to hide attachments while retaining audit entries." Does "hide" mean the file data is removed from IndexedDB, or only hidden from UI?

**My Understanding:** Since the Prompt says "retaining audit entries," the intent is logical deletion, not physical deletion. The file bytes and hash remain in IndexedDB; only the UI hides them.

**Solution:** On consent revocation, `document.hidden = true` is set. No file data is removed. Compliance Reviewers and Admins can still see a redacted record (file name, review status) for audit purposes, but cannot access file contents. A consent revocation audit entry is created.

---

## 5. Message Masking — Applied at Write or Read Time?

**Question:** Should phone/email masking be applied when the message is saved to IndexedDB, or only when rendered in the UI?

**My Understanding:** Masking at write time is safer (data never stored unmasked), but loses the original for audit. The Prompt says the `originalBody` might be needed for audit, yet the masking policy must be enforced.

**Solution:** The `body` field stored in IndexedDB is always the masked version. The `originalBody` field is stored encrypted (AES-GCM) and is accessible only to Admin for audit review. The `mask.pipe.ts` applies a second pass at render time as a defense-in-depth measure.

---

## 6. Enrollment Prerequisites — "Prior Completion" Across Residents?

**Question:** Prerequisites include "prior completion flags." Does this mean completion of a specific other course, or any course?

**My Understanding:** It must be course-specific (e.g., "Course B requires completion of Course A"). The Prompt's phrasing "prior completion flags" suggests a boolean flag per course per resident, not a generic completion counter.

**Solution:** `course.prerequisites` includes `{ type: 'prior_completion', courseId: string }`. At enrollment time, the service checks `enrollments` for a record matching `{ residentId, courseId: prerequisiteCourseId, status: 'completed' }`.

---

## 7. Waitlist Backfill — "Deterministic" — What Algorithm?

**Question:** The Prompt says "deterministic backfill" for waitlists. Does this mean strict FIFO, or is there a priority system?

**My Understanding:** "Deterministic" means reproducible — given the same state, the same person is always promoted. FIFO (first-on-waitlist, first promoted) is the simplest deterministic algorithm and the most defensible for fairness.

**Solution:** When a spot opens (drop or capacity increase), the system promotes the resident at index 0 of `courseRound.waitlisted` array. The promotion is logged as an immutable enrollment history entry. No randomness, no priority override unless an Admin manually reorders the waitlist (which itself is audit-logged).

---

## 8. Search — "Full-Text" Without a Backend. Which Library?

**Question:** Full-text search with synonym expansion, spell correction, and facets is non-trivial in a browser-only context. Which implementation approach is expected?

**My Understanding:** A lightweight client-side search library is appropriate. The Prompt does not specify a library. Lunr.js or Fuse.js are the standard choices for offline Angular apps.

**Solution:** Using **Lunr.js** for full-text indexing (supports field boosting for title vs. body). Synonym expansion is applied as a query pre-processing step using the `searchDictionary`. Spell correction uses edit-distance (Levenshtein) against `searchDictionary.corrections`. The Lunr index is rebuilt on import and updated incrementally on new data. Facet filtering is applied post-search as an in-memory filter.

---

## 9. Analytics / A/B Comparisons — What Is Being A/B Compared?

**Question:** The Prompt mentions "A/B comparisons" for the Operations Analyst role but does not specify what is being compared.

**My Understanding:** In a resident management context, A/B comparisons most likely refer to comparing two time periods, two buildings, two course enrollment rates, or two message campaign open rates — not a live A/B test framework.

**Solution:** The Analytics module provides a "Compare" view where the Analyst selects two date ranges, buildings, or cohorts and sees side-by-side metrics (enrollment rates, search trends, message volume, compliance queue throughput). No randomized experiment infrastructure is implemented.

---

## 10. Anomaly Detection — Per-Session or Global?

**Question:** ">30 searches/minute" — is this per user session or globally across all sessions? Since everything is local, "global" means the current browser context only.

**My Understanding:** Since there is no backend, anomaly detection is per-session (per browser tab). A single session's activity is what is monitored.

**Solution:** `anomaly.service.ts` maintains an in-memory sliding window (60-second window, rolling). Events are not persisted between sessions intentionally — a new session starts fresh. However, flagged events from the previous session appear in the audit log which persists.

---

## 11. Import — Duplicate Key Handling — Skip or Overwrite?

**Question:** On import, if a record with the same ID already exists, should it be skipped or overwritten?

**My Understanding:** The Prompt says "duplicate-key handling on import" without specifying the behavior. Overwrite is dangerous (could erase newer data); skip is safer but may leave stale data.

**Solution:** On import, the user is prompted with a choice: "Skip duplicates" (safe merge) or "Overwrite all" (full restore). The default is "Skip duplicates." The choice and count of skipped/overwritten records are written to the audit log.

---

## 12. Zero-Results Report — How Is It Surfaced?

**Question:** The Prompt mentions a "zero results report for operations tuning." Is this a live dashboard widget or an exported report?

**My Understanding:** Since the Analyst role has a dashboard, this is most naturally a dashboard widget showing the top N zero-result queries over a time period, with frequency counts.

**Solution:** `search.service.ts` logs every zero-result query to an IndexedDB store (`zeroResultsLog: { query, timestamp }`). The Analytics dashboard has a "Search Health" panel showing the top 20 zero-result queries of the past 30 days, with a "Add to Dictionary" shortcut to add synonyms or corrections.

---

## 13. Content Safety Review — Local Keyword Policies — What Keywords?

**Question:** The Prompt references "basic keyword policies" for content safety. Are these pre-defined or Admin-configurable?

**My Understanding:** Admin-configurable keyword lists are more useful for a property management context (e.g., flagging profanity, personal data patterns, or specific terms). A hardcoded list would be too rigid.

**Solution:** Admins can manage a `contentPolicies` table in IndexedDB: a list of keyword patterns (plain strings or regex) that, when found in a message body, place it in the compliance review queue automatically. A default set of 10 common profanity/PII patterns is seeded on first run.

---

## 14. Re-Authentication Modal — Does It Re-Derive the Crypto Key?

**Question:** When anomaly detection triggers a re-auth modal, does the user re-entering their password also refresh/re-derive the AES-GCM key?

**My Understanding:** Yes — the re-auth step serves dual purpose: identity confirmation and key freshness. This is consistent with the security model described in the Prompt.

**Solution:** The re-auth modal calls `crypto.service.deriveKey(password, storedSalt)` and replaces the in-memory key. If the derived key successfully decrypts a test cipher (stored during initial setup), the session continues. Failure locks the session.

---

## 15. Thread Privacy — Can Admin Read All DM Threads?

**Question:** The Prompt doesn't clarify if Admins can read all direct message threads. In a property management context this could be a compliance requirement.

**My Understanding:** Admins should have read access to all threads for compliance/safety purposes, but this access should be audit-logged. Residents are not notified when Admin reads a thread.

**Solution:** `messaging.service.getThread(threadId, role)` allows Admin to access any thread. Every Admin access to a non-participant thread is written as a `MESSAGE_ADMIN_ACCESS` audit entry. The UI shows a visible "Admin View" banner in the thread when the Admin is not a participant.