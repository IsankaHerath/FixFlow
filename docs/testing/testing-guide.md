# Testing guide

Use a dedicated development/test PostgreSQL database. Integration fixtures create
unique IDs and remove only their own rows; they never reset the database. Browser
tests retain archived test vehicles, cancelled bookings, inactive inventory,
suspended test centers and random test accounts
for traceability. Never point these suites at production or a live customer host.

## Commands

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run lint
npm run typecheck
npx prisma validate
npx prisma migrate status
npm test
$env:RUN_INTEGRATION='true'
npm test
```

Default `npm test` skips DB integration suites unless explicitly enabled. A green
unit-only run is not proof of the persisted workflow.

## Browser tests

Configure demo seed credentials privately, run `npm run db:seed`, and keep
`npm run dev` running on the configured test origin. On Windows the default
browser channel is installed Edge. To use bundled Chromium:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL='chromium'
npm run test:e2e
```

CI on Linux uses `npx playwright install --with-deps chromium`. The password-reset
test reads the development local mail outbox; run without SMTP and against the
local development server, not a remote production deployment. Authentication
rate limits remain enabled: allow the 60-second window to pass before repeatedly
rerunning login tests. No test bypass is installed.

## Coverage

- Unit: transitions, integer totals/tax, slots/time zones, reminder thresholds,
  concurrent capacity calculation, exact decimal-to-minor-unit conversion.
- PostgreSQL integration: persistence and ownership; competing appointments;
  technician membership; versioned approvals and blocked premature work; stock
  idempotency/insufficient quantity; quality clearance; history/reminder creation;
  invoice snapshots/PDF authorization; overpayment and duplicate payments; closure.
- Dispatch integration: simultaneous email workers, retries, opt-out, due/future/
  dismissed reminders and duplicate reminder processing. SMTP is mocked for these
  tests, so they establish queue behavior rather than provider delivery.
- Browser/API: responsive public pages, customer vehicle/booking persistence,
  role workspaces, private route redirects, registration privilege escalation
  denial, mutation Origin guard, database sessions, password-reset single use,
  cron authentication and screenshots.

Browser failure traces/screenshots are in ignored `test-results`. Selected
successful screenshots are in `docs/screenshots`. The suites are representative,
not exhaustive route-by-route security certification. Additional tests are needed
for provider outages under sustained load and every possible UI workflow branch.

## Production build

```powershell
npm run build
npm start
```

Run the build after source/schema changes. It generates Prisma and invokes the
Next production compiler. The application needs real runtime environment values
and database connectivity when serving dynamic routes. Record exact final results
in IMPLEMENTATION.md; do not substitute historical results for a current run.
