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

## Live verification — all pending

- [ ] Clerk application and Convex integration configured.
- [ ] Convex development schema/functions deploy successfully.
- [ ] A and B can sign in; signed-out private calls fail against the deployed backend.
- [ ] A creates a listing; B sees it and requests a date range.
- [ ] A approves; a second overlapping approval fails.
- [ ] Race two approval mutations on the deployed backend; exactly one succeeds.
- [ ] n8n A imports, activates and executes a signed webhook.
- [ ] Its logged mock is correlated with exactly one Convex result.
- [ ] A modified signature and expired timestamp are rejected by the deployed receivers.
- [ ] Seed an overdue fictional loan; n8n B executes and records a reminder.
- [ ] Run B again that day; no second logical reminder/result is created.
- [ ] Repeat the request webhook and completion; no additional logical result.
- [ ] Stop only the test n8n, create a request, observe pending/retry, restart and observe recovery.
- [ ] Force five failures and demonstrate an admin-visible terminal error and safe retry.
- [ ] Confirm the owner's return; borrower/stranger attempts fail.
- [ ] Verify the error workflow link and failed execution visibility in n8n.
- [ ] Re-run build/test/secret review before publishing or sending the application.

Record deployment environment, date, sanitized event/execution IDs and pass/fail per item. Do not record tokens, keys, entire signed envelopes or real customer data.
