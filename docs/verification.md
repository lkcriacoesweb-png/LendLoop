# Verification ledger

Initial local work: November 2, 2026. No production data or deployment credentials were used.

## Completed local checks

- TypeScript static checking passed.
- Next.js production build passed. The Windows sandbox initially blocked an output directory; the same build completed outside the sandbox, without code changes for that error.
- 30 automated tests passed: 5 domain, 4 signing, 17 Convex backend, 4 exported workflow contracts.
- Local Next.js `/preview` served and was opened in the browser. Desktop screenshots of the public page and preview were reviewed. The preview's listing creation, search, incoming-request approval and return confirmation worked. A 390-pixel viewport check showed no document-width overflow. This is UI-preview evidence only.
- Workflow exports generated without embedded credentials.
- `npm audit --omit=dev` reported zero known production dependency advisories at the time of this check. This does not cover the n8n image or prove that dependencies have no vulnerabilities.

The tests use `convex-test` and mock identity. Workflow tests execute the exported JavaScript sources with mock n8n globals and invoke Convex HTTP handlers through the mock backend. They are not n8n engine executions and do not verify Clerk JWT validation. Parallel Windows sandbox runs encountered a temporary-module file error/shutdown handles. All 30 tests passed cleanly when run outside the sandbox with file parallelism disabled; that setting is now in the test config.

## Live verification — November 5, 2026 (UTC)

Environment: Next.js on Vercel (https://lendloop-xi.vercel.app), Convex **production** deployment in US East, a Clerk **development** instance with the Convex integration enabled, and n8n 2.45.7 from `compose.hosted.yaml` behind HTTPS on a dedicated server (Coolify/Traefik). Two Clerk test accounts (A, the owner and admin; B, a borrower) signed in on the deployed site. A third party, C, is a synthetic identity passed to `npx convex run --identity`: it exists only in the LendLoop database, not in Clerk. Backend checks ran through the Convex CLI with a production deploy key; signature checks hit the public `.convex.site` routes. IDs below are shortened.

- [x] Clerk application and Convex integration configured: the session token carries `aud: "convex"`, and `CLERK_JWT_ISSUER_DOMAIN` is set in the Convex production environment.
- [x] Convex production schema and functions deploy successfully: tables and 14 indexes created by `npx convex deploy`; the Vercel build runs the same command.
- [x] A and B can sign in; signed-out private calls fail against the deployed backend. Both accounts completed their profiles through the authenticated `profiles:register` mutation. Unauthenticated `loans:mine` and `tools:browse` on the public HTTP API returned `status: "error"`. A signed-out visit to `/workspace` is redirected to Clerk.
- [x] A creates a listing; B sees it and requests a date range. Repeating B's request with the same client key returned the same loan ID instead of a duplicate.
- [x] A approves; a second overlapping approval fails with "Another loan overlaps or is awaiting return."
- [x] Race two approval mutations on the deployed backend; exactly one succeeds. Two concurrent approvals by A for B's and C's overlapping requests: B's was approved, C's was rejected with the overlap error.
- [x] n8n A imports, activates and executes a signed webhook. The three workflows were imported through the n8n public API; request events completed with `simulated` results.
- [x] Its logged mock is correlated with exactly one Convex result. Event `j5787zq…` has one container log line from "Simulate notification" and one `notificationResults` row with n8n execution `9`.
- [x] A modified signature and expired timestamp are rejected by the deployed receivers: HTTP 400 on `/automation/claim` (one changed signature character) and `/automation/overdue` (timestamp 10 minutes old). An unsigned POST to the n8n webhook fails in "Verify signed event".
- [ ] Seed an overdue fictional loan; n8n B executes and records a reminder. **Pending.** The seed is disabled in production by design, so A approved a real loan for B dated 2026-11-05 only. It becomes overdue on 2026-11-06, and B's first window run is 09:00 UTC that day.
- [ ] Run B again that day; no second logical reminder/result is created. **Pending**, same reason.
- [x] Repeat the request webhook and completion; no additional logical result. The same completion envelope sent twice returned the identical stored response; a new envelope for the same completion returned `duplicate: true`; a repeated claim returned `process: false`. `notificationResults` grew only by the new event's single row.
- [x] Stop only the test n8n, create a request, observe pending/retry, restart and observe recovery. With n8n stopped, request R2 stayed `pending` with "Webhook unavailable, timed out, or misconfigured." through three attempts; after the restart its fourth attempt completed as `simulated`.
- [x] Force five failures and demonstrate an admin-visible terminal error and safe retry. Request R1, with n8n stopped, retried with growing delays (about 1, 2, 4 and 8 minutes) and became `failed` after attempt 5. It appeared in `automation:failures` for A (admin); B was refused both the list and the retry. A's retry completed it as `simulated` with exactly one result.
- [x] Confirm the owner's return; borrower/stranger attempts fail. The borrower and C were refused with "You cannot make this change."; C reading the loan was refused with "This loan is private."; A recorded the return (`returned`).
- [x] Verify the error workflow link and failed execution visibility in n8n. A and B point to C as their Error Workflow; failed executions of A are listed by the n8n API; a failure of A produced C's line `{"outcome":"workflow_failed","workflowId":"dI93Uwb…","executionId":"10"}` in the container log.
- [x] Re-run build/test/secret review before publishing: typecheck, 31 tests, secret scan and production build passed on the final tree.

### Defects the live run found, now fixed

1. **The error workflow never logged anything.** It used `console.error`, and the n8n task runner forwards only `console.log`; every other console method is a no-op (read in `js-task-runner.js` of the running image). It now uses `console.log`, and a contract test fails if it does not: 31 tests in total.
2. **On n8n 2.45.7 the error workflow must be published.** The unpublished one was skipped with `Workflow "…" is not active and cannot be executed`. README step 8 now says to publish all three.
3. **Production Code-node logs never reached the container log.** Both Compose files now set `CODE_ENABLE_STDOUT=true`, as the n8n documentation describes.

Record deployment environment, date, sanitized event/execution IDs and pass/fail per item. Do not record tokens, keys, entire signed envelopes or real customer data.
