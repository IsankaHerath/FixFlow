# Deployment and operations

No live deployment is claimed. A successful local build is one prerequisite;
provider configuration and operational validation remain deployment tasks.

## Release sequence

1. Provision a Node.js 24 host and PostgreSQL 16 with private connectivity,
   verified TLS, restricted credentials and backups. Configure an HTTPS domain.
2. Store production variables in the host's secret manager. Set the canonical
   HTTPS `BETTER_AUTH_URL`, fresh auth/cron secrets and real SMTP credentials.
   Disable demo seeding and remove demo/bootstrap passwords.
3. Install using `npm ci`; generate Prisma. Back up the database and apply
   `npm run db:migrate` once as a release job. Check `prisma migrate status`.
   Do not run migrate dev/reset/db push in production.
4. Run lint, typecheck and tests in a separate test environment. Build with
   `npm run build`, then start with `npm start` behind the host's HTTPS proxy.
   Avoid two releases applying schema changes concurrently.
5. Bootstrap the administrator if this is a new database. Verify login/logout,
   secure cookies over HTTPS, password recovery, tenant denial and a complete
   test-center booking-to-payment journey without charging real cards.
6. Configure scheduled POST jobs described below. Verify accepted SMTP messages
   arrive in a controlled mailbox. Monitor failures, database latency and errors.

Better Auth derives secure-cookie behavior from production/HTTPS configuration.
Inspect actual cookies at the deployed origin; do not rely on localhost checks
as proof of production cookie/proxy behavior. Ensure trusted proxy IP handling
cannot be spoofed, since auth throttling depends on correct client attribution.

## Scheduled processing

POST `/api/cron/reminders` daily or hourly and POST `/api/cron/notifications` every
few minutes with `Authorization: Bearer <CRON_SECRET>`. Do not put the secret in
URLs, browser JavaScript or logs. No scheduler is installed by application startup.

Reminder runs process at most 500 eligible records and atomically mark each as
notified with its in-app notice. Email runs claim at most 50 eligible notices.
Overlapping workers cannot claim the same current attempt. A lease expires after
10 minutes; failed/stale sends retry up to three total attempts. Increase scheduler
frequency if a backlog grows. Investigate exhausted failures before an operator
deliberately requeues them; there is no retry-management UI yet.

SMTP acceptance is not delivery confirmation. Configure provider monitoring,
SPF/DKIM/DMARC and bounce handling operationally. Password-reset emails are sent
directly and depend on a working provider, independently of the notification queue.

## Reliability and maintenance

- Keep database point-in-time or scheduled backups and verify restoration in an
  isolated environment. Preserve the migration history alongside releases.
- Record application errors without session cookies, passwords, reset links or
  authorization headers. The current app has basic server error reporting;
  centralized structured logs/alerts require host configuration.
- Budget PostgreSQL connections for each Node process. Test horizontal scaling
  and pool sizing before increasing replicas; no load-test claims are made.
- Roll back application releases only when compatible with the migrated schema.
  Destructive rollback requires a reviewed recovery plan and backups.
- Run `npm audit --omit=dev` and inspect full audit regularly. See IMPLEMENTATION
  for the verified snapshot and unresolved development-tool advisories.
- Protect local SMTP outbox files, uploads if added later, and database volumes.
  Do not use test/demo data as production customer data.

## Known release gaps

Live hosting, production email deliverability, scheduler installation, backup
restore drills, accessibility certification, sustained load testing and external
penetration testing have not been verified. Non-Latin PDF fonts, credit notes,
refunds, custom report exports and large paginated selectors remain product extensions.
