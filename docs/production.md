# Production readiness

This is a bounded take-home implementation, not a compliance certification or a production deployment.

| Area           | Implemented locally                                                  | Required before production                                                          |
| -------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Identity       | Clerk integration, server-derived identity                           | Real login/JWT verification, separate environments, MFA for operators               |
| Authorization  | Convex participant/owner/admin checks; internal role setup           | Review operator access, offboarding and audit attribution                           |
| Reservations   | Transactional overlap check + shared revision                        | Run simultaneous-approval test on real Convex; load testing                         |
| Automation     | HMAC in both directions, bounded retries, leases, result idempotency | Run actual n8n workflows, alert on backlog and terminal failures                    |
| Delivery       | Explicit logged mock                                                 | Real provider, provider idempotency, bounce/failure handling, recipient lookup      |
| n8n            | Loopback Compose, named volume, trusted local internal runners       | TLS ingress, protected editor, external hardened runners, secrets manager           |
| Abuse          | Per-profile active-item limits, field/date validation, HTTP body cap | Rate limiting, signup abuse controls, per-IP budgets, request quotas                |
| Data lifecycle | Soft deletion, replay receipt expiry, n8n execution pruning          | Approved retention durations, account erasure/anonymization, backup expiry          |
| Scale          | Bounded lists/batches                                                | Pagination, indexed backlog partitioning, larger overdue batches without starvation |

Use separate Clerk, Convex and n8n development/staging/production environments. Restrict dashboard and CI deployment credentials. Rotate automation keys in a coordinated maintenance window: the current protocol has one key per direction, not a key-ID rotation ring. Keep n8n's encryption key backed up securely with its database; losing it can make stored credentials unusable. Never store secrets in `NEXT_PUBLIC_*`, workflow JSON, Git, tickets or logs.

The supplied Compose is for an isolated mock-data developer instance only. It uses `N8N_SECURE_COOKIE=false` because localhost runs over HTTP, and permits trusted Code nodes to access environment variables. Before hosting, enable HTTPS and secure cookies, keep the editor behind authentication/access controls, use external task runners with an explicit crypto allow-list and narrow secret injection, and protect the webhook with request-size/rate limits. Do not expose the editor merely to make a webhook reachable. Internal task runners share the n8n process identity and are not a production isolation boundary.

Back up the n8n volume and encryption key separately, test restoring into a clean environment, and document the recovery time objective. Configure Convex backups/exports appropriate to the selected service plan and perform a recovery drill. Pin reviewed versions and schedule dependency/advisory checks; a lockfile does not guarantee absence of vulnerabilities. Review Docker image provenance and current vendor advisories before hosting.

Alert on failed events, oldest pending event age, processing leases past expiry, no successful daily reminder run, 4xx signature failures and sustained 5xx errors. Event IDs correlate the workflow with the backend. Application logs must never include an entire signed envelope, credential, contact record or clinical message. n8n failed-execution storage can contain short-lived signed envelopes; restrict access and review the default 72-hour retention.

Lists currently cap at 200 and the overdue query at 100. They deliberately keep the demo small but are not complete pagination. Large backlogs can starve later entries until pagination/index partitioning is added. Cron-based retries and provider polling incur usage; set budget alerts, concurrency limits and bounded queue processing based on measured demand.

Retain only the data needed to provide the service. Soft-deleting a listing is not account erasure. Decide how long loans, audit events and profiles are needed, implement deletion/anonymization with appropriate legal review, and cover backups and downstream notification systems. No GDPR, LGPD or HIPAA compliance is asserted by this repository.

A healthcare adaptation would require much more than changing labels: data classification, contracts with processors, risk assessment, access auditing, retention and incident response, and explicit review of external automation/AI processing. Clinical content should not be copied into this demonstration.
