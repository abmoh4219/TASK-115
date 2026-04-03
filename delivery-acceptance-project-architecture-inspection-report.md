# Delivery Acceptance / Project Architecture Inspection

## 1. Verdict
**Partial Pass**

## 2. Scope and Verification Boundary
- Reviewed frontend project under `repo/` against the provided Prompt and Acceptance/Scoring Criteria, with focus priority: runnability, prompt-fit, security-critical behavior, tests, and major engineering quality.
- Excluded all sources under `./.tmp/` (none were used as evidence).
- Runtime verification executed (non-Docker only): `npm run build`, `npm run test:unit -- --runInBand`, and `npm run test:api`.
- Docker-based verification was documented in `README`, but intentionally not executed per review constraints.
- Not executed: browser E2E walkthrough of full UX flows; therefore final UI/interaction behavior is partially inferred from code and build/test outputs.
- Remaining unconfirmed: true runtime user-journey closure for some page flows (notably search result actionability and role-switch leakage behavior across full UI sessions).

## 3. Top Findings

### Finding 1
- **Severity:** High
- **Conclusion:** Service-layer authorization is incomplete in messaging flows.
- **Brief rationale:** Prompt requires role checks in guards and service methods (not view layer only). `createThread` and `sendMessage` do not enforce participant/role constraints robustly.
- **Evidence:**

```70:80:repo/src/app/core/services/messaging.service.ts
  async createThread(participantIds: number[], subject: string): Promise<Thread> {
    const now = new Date();
    const id = await this.db.threads.add({
      participantIds,
      subject: DOMPurify.sanitize(subject),
      lastMessageAt: now,
      createdAt: now,
    });
```

```121:131:repo/src/app/core/services/messaging.service.ts
  async sendMessage(params: {
    threadId:    number;
    recipientId?: number;
    rawBody:     string;
    type:        'announcement' | 'direct';
    templateId?: number;
  }): Promise<Message> {
    const senderId = this.auth.getCurrentUserId();
    const senderRole = this.auth.getCurrentRole();
```
- **Impact:** A caller can create threads/send messages without strict server-equivalent service checks (participant validation and policy enforcement), increasing privilege-escalation/tampering risk.
- **Minimum actionable fix:** Enforce authenticated role checks in `createThread` and `sendMessage`; for direct messages validate sender participation and thread existence; block unauthorized posting paths in service layer.

### Finding 2
- **Severity:** High
- **Conclusion:** Content safety policy management exists, but policy enforcement is not wired into message/document review processing.
- **Brief rationale:** Prompt explicitly requires local review queue + basic keyword policies enforcement. Policies are editable in settings but not applied in core moderation/message pipelines.
- **Evidence:**

```736:756:repo/src/app/features/settings/settings.component.ts
  private async loadPolicies(): Promise<void> {
    this.policies = await this.db.contentPolicies.toArray();
    this.cdr.markForCheck();
  }

  async togglePolicy(p: ContentPolicy): Promise<void> {
    await this.db.contentPolicies.update(p.id!, { enabled: !p.enabled });
    this.loadPolicies();
  }

  async addPolicy(): Promise<void> {
```

```132:145:repo/src/app/core/services/messaging.service.ts
    const sanitized = DOMPurify.sanitize(params.rawBody);
    const masked    = maskSensitiveContent(sanitized);

    // Encrypt original (pre-mask) body for audit trail
    let encryptedOriginal: string | undefined;
    try {
      const sessionKey = this.crypto.getSessionKey();
```

```84:89:repo/src/app/core/services/document.service.ts
  async getPendingReview(): Promise<HpDocument[]> {
    this.requireRole('compliance', 'admin');
    return this.db.documents
      .filter(d => d.status === 'pending_review' && !d.hidden)
      .toArray();
```
- **Impact:** Safety policies can be configured but not actually enforced, so prohibited/flaggable content may pass through despite compliance configuration.
- **Minimum actionable fix:** Add a dedicated content-policy evaluation service and invoke it from messaging/document review paths before persistence/approval; emit audit events when policy rules trigger.

### Finding 3
- **Severity:** Medium
- **Conclusion:** Search flow does not complete user task closure (result click is no-op).
- **Brief rationale:** Prompt expects operationally useful search; current result interaction is intentionally non-functional.
- **Evidence:**

```773:776:repo/src/app/features/search/search.component.ts
  openResult(r: SearchResult): void {
    // No-op navigation — results are informational in this build
    // Future: router.navigate based on entityType + entityId
  }
```
- **Impact:** Users can discover results but cannot navigate into related entities/tasks, reducing end-to-end credibility.
- **Minimum actionable fix:** Implement entity-aware routing (resident/document/message/course detail destinations) and empty/not-found handling on target pages.

### Finding 4
- **Severity:** Medium
- **Conclusion:** Drop-window rule is configurable, not guaranteed as strict “no drops within 2 hours of start.”
- **Brief rationale:** Prompt states a concrete business rule; implementation trusts a mutable `dropCutoffAt` instead of enforcing `startAt - 2h`.
- **Evidence:**

```80:90:repo/src/app/core/services/enrollment.service.ts
  async createRound(params: CreateRoundParams): Promise<CourseRound> {
    this.requireRole('admin');
    const id = await this.db.courseRounds.add({
      courseId:         params.courseId,
      startAt:          params.startAt,
      endAt:            params.endAt,
      capacity:         params.capacity,
      waitlistCapacity: params.waitlistCapacity,
      addCutoffAt:      params.addCutoffAt,
      dropCutoffAt:     params.dropCutoffAt,
```

```194:196:repo/src/app/core/services/enrollment.service.ts
    const now = new Date();
    if (now > round.dropCutoffAt) return { success: false, reason: 'DROP_CUTOFF_PASSED' };
```
- **Impact:** Misconfigured rounds can violate the mandated cutoff behavior.
- **Minimum actionable fix:** In service layer, validate and/or derive `dropCutoffAt = startAt - 2h` (or enforce `now <= startAt - 2h` directly in `drop`).

### Finding 5
- **Severity:** Low
- **Conclusion:** Build is runnable but emits a large volume of CSS syntax warnings.
- **Brief rationale:** `npm run build` succeeds, but repeated nesting warnings indicate maintainability/visual-risk debt.
- **Evidence:** Runtime command output from `npm run build` showed repeated warnings such as “Cannot use type selector '--...’ directly after nesting selector '&'”.
- **Impact:** Increased risk of styling inconsistencies and future tooling breakage.
- **Minimum actionable fix:** Normalize invalid nested selectors to valid CSS/Sass syntax and enforce lint/style checks in CI.

## 4. Security Summary
- **Authentication / login-state handling:** **Pass**
  - Evidence: Session state and lock/reauth flows are present in `auth.service.ts` (`isLoggedIn`, `lockSession`, key derivation, inactivity timer) and app-level reauth modal wiring in `app.component.ts`.
- **Frontend route protection / route guards:** **Pass**
  - Evidence: Route-level guards are consistently wired in `app-routing.module.ts` and implemented in role guards under `core/guards/`.
- **Page-level / feature-level access control:** **Partial Pass**
  - Evidence: Many services use `requireRole`; however messaging service lacks strict checks in thread/message write paths (Finding 1), and some privileged data mutations occur directly in component-level DB calls in settings.
- **Sensitive information exposure:** **Partial Pass**
  - Evidence: At-rest crypto and masking are implemented; however console logging of errors remains (`logger.service.ts`) and can surface internal error messages in dev contexts.
- **Cache / state isolation after switching users:** **Cannot Confirm**
  - Evidence boundary: static review shows session key and auth state reset on lock/logout, but full runtime cross-role leakage behavior across all pages/components was not executed end-to-end in browser.

## 5. Test Sufficiency Summary
### Test Overview
- **Unit tests exist:** Yes (`unit_tests/` with broad service coverage).
- **Component tests exist:** Partial (limited; e.g., `table.component.spec.ts`, pipe/service-heavy coverage dominates).
- **Page / route integration tests exist:** Partial (integration-like tests in `api_tests/` are mostly service/data-layer, not full route/UI flow tests).
- **E2E tests exist:** Missing (no clear Cypress/Playwright entrypoint in scripts).
- **Obvious test entry points:** `npm run test:unit`, `npm run test:api`.

### Core Coverage
- **Happy path:** **Covered**
  - Evidence: unit + api test suites pass (`16` unit suites, `9` integration suites) with core service flows exercised.
- **Key failure paths:** **Partially Covered**
  - Evidence: many validation and authorization failures are tested; but important flow-level closures (e.g., actionable search navigation) are untested.
- **Security-critical coverage:** **Partially Covered**
  - Evidence: `authorization.service.spec.ts` covers multiple role rejections; missing tests for messaging thread creation/send participation constraints and content-policy enforcement linkage.

### Major Gaps (Top 3)
- Missing tests for unauthorized or cross-thread message posting constraints in messaging write methods.
- Missing tests for actual content-policy enforcement outcomes (block/flag/redact) in messaging/document review pipelines.
- Missing browser-level E2E coverage for route-guarded user journeys and role-switch isolation.

### Final Test Verdict
**Partial Pass**

## 6. Engineering Quality Summary
- Project structure is generally credible for scope (Angular routing, feature modules/components, service layer separation, IndexedDB persistence, crypto/import-export services).
- Maintainability risk is concentrated in security-boundary consistency: several critical checks are centralized well, but not uniformly enforced in every privileged pathway.
- Test organization is strong at service-level, weaker at UI route/task-closure level.
- Overall quality is above demo level, but current security/prompt-fit gaps prevent full acceptance.

## 7. Visual and Interaction Summary
- Visual system appears coherent and reasonably polished across major pages (dashboard, messaging, enrollment, search, settings), with loading/empty/error states present in many views.
- Material interaction gap: search result click does not complete navigation flow (Finding 3).
- Build-time CSS warnings indicate potential visual regressions/fragility despite current successful build.

## 8. Next Actions
1. **(High)** Enforce strict service-layer authorization in messaging write flows (`createThread`, `sendMessage`) including participant/thread checks.
2. **(High)** Implement and test content-policy enforcement in core pipelines (message submission and compliance review decisions), not only policy CRUD.
3. **(Medium)** Make search results actionable with entity routing and route-level tests for result-to-task closure.
4. **(Medium)** Enforce non-configurable 2-hour drop cutoff in enrollment service logic.
5. **(Medium)** Add minimal E2E coverage for role-based routes, critical happy paths, and role-switch isolation behavior.
