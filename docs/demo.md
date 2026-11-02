# Demonstration — 5 to 10 minutes

Use fictional data and two browser profiles, A (owner) and B (borrower). Do not present `/preview` as the live product.

1. **0:00–1:00 — Public catalog.** Open `/` signed out. Explain that the backend response exposes only names and categories. Show the actual query in `convex/tools.ts`.
2. **1:00–2:00 — Sign in and list.** A signs in through Clerk, creates a display name and lists a tool. Show category, condition and description. Explain that the backend assigns the owner from the token.
3. **2:00–3:00 — Request.** B signs in, filters the tools and requests tomorrow through the following day. Show My requests. A sees Incoming requests.
4. **3:00–4:00 — Approval.** A approves. Show the new reservation and B's status. Attempt an overlapping approval in a prepared second request and show the backend error.
5. **4:00–5:30 — Request automation.** Open n8n Executions and the matching Convex event/result. Show an execution ID and `simulated`. State explicitly that the notification is a logged mock, not a delivered email. Explain why webhook HTTP 200 is insufficient.
6. **5:30–7:00 — Overdue reminder.** Use the development seed's overdue loan. Run workflow B, show one completed reminder, then run it again. There should still be one logical result for that day. Show the daily key.
7. **7:00–8:00 — Return and admin.** A confirms return. Show that B cannot do so. With the prepared admin account, show moderation, trusted-lender toggle and the failure dashboard.
8. **8:00–10:00 — Failure and tradeoffs.** Show a previously recorded outage/recovery run. Explain bounded attempts, the retry button, mock-vs-live evidence, retained history, batch caps and what changes before production.

Prepare failure examples before recording; do not wait through all retries in a short interview. Use the live verification checklist to collect evidence first. Finish by offering to modify a small rule and run the relevant test.
