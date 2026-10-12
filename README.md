# FixFlow

A multi-center vehicle service application built with Next.js, TypeScript,
PostgreSQL, Prisma and Better Auth. Customers book service and approve estimates;
workshops manage inspections, repairs, inventory, invoices and recorded payments.

## Run locally

Use Node.js 24, npm and PostgreSQL 16. From the project directory:

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env: database connection, app URL and two independently generated secrets.
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000. See the [installation guide](docs/deployment/installation.md)
for PostgreSQL, optional demo data and first administrator setup. Do not overwrite
an existing `.env`. No shared demo password is stored in the repository.

## Implemented

- Responsive public website, searchable center discovery and center details.
- Registration, database sessions, login, logout and single-use password recovery.
- Customer vehicle records, mileage history, booking availability, rescheduling,
  repair tracking, estimate decisions, invoice PDFs and maintenance reminders.
- Manager appointments/check-in, technicians, catalog, inspection/repair workflow,
  estimate versions, inventory movements, invoicing, payments and monthly CSV reports.
- Technician assignments, inspections, tasks, parts consumption and repair status.
- Administrator center approval/suspension, staff creation, user suspension and audit logs.
- In-app notifications and an authenticated, retryable email dispatcher.

Amounts are stored in integer LKR minor units. UI money inputs accept rupees with
two decimal places. Payments record an external cash/card/bank transaction; the
application does not charge cards or connect to a payment gateway.

## Documentation

- [Architecture](docs/architecture/system-architecture.md)
- [Database and ER diagram](docs/database/database-design.md)
- [API reference](docs/api/api-documentation.md)
- [Roles and business workflows](docs/workflows/business-workflows.md)
- [Installation, PostgreSQL and environment](docs/deployment/installation.md)
- [Deployment operations](docs/deployment/deployment-guide.md)
- [Testing](docs/testing/testing-guide.md)
- [Verified progress and remaining work](IMPLEMENTATION.md)

```powershell
npm run lint
npm run typecheck
npm test
$env:RUN_INTEGRATION='true'; npm test
npm run test:e2e
npm run build
npm start
```

Integration tests require migrated PostgreSQL. Browser tests require a running
development server, demo seed, `DEMO_PASSWORD`, and Edge (or configured Chromium).
See the testing guide before running either suite. This repository is not a
verified live deployment; production SMTP, hosting, scheduled jobs, backups and
HTTPS must be configured and verified by the operator.
