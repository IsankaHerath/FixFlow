# Installation and configuration

## Requirements

Node.js 24 and npm, PostgreSQL 16, and an SMTP provider for production. The app uses
Node runtime features (pg, SMTP, PDF generation); deploy to a Node-capable host.
The checked-in lockfile is the dependency source of truth: use `npm ci`.

## PostgreSQL

Option A: use the included Docker Compose database. Set `POSTGRES_PASSWORD` to a
random local secret in your environment and run `docker compose up -d db`.
The database is `fixflow`, user `fixflow`, at loopback port 5432. The named volume
persists data. Do not remove that volume when upgrading the app.

Option B: use an existing PostgreSQL installation. Have an administrator create
a dedicated login/database and grant ownership or migration privileges. Use SCRAM
authentication and bind local development databases to loopback. The development
instance used during verification is an isolated PostgreSQL 16 cluster under
`.local/postgres` on port 5438; it is not required for other installations.

For that existing Windows instance only:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' -D D:\FixFlow\.local\postgres -l D:\FixFlow\.local\postgres.log -o '-h 127.0.0.1 -p 5438' start
```

Do not initialize this directory again or replace an existing database. Check
`pg_ctl status -D D:\FixFlow\.local\postgres` before starting a second instance.

## Application

Copy `.env.example` to `.env` only if `.env` does not exist. Supply your connection
and secrets, then run:

```powershell
npm ci
npm run db:generate
npm run db:migrate
npx prisma migrate status
npm run dev
```

Generate independent random secrets, for example with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Never commit `.env`, database files, reset mail or passwords.

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URI; percent-encode password characters; use verified TLS remotely |
| `BETTER_AUTH_URL` | Exact external app origin, localhost in development and HTTPS in production |
| `BETTER_AUTH_SECRET` | Random authentication secret, at least 32 characters |
| `CRON_SECRET` | Separate random bearer secret for scheduled routes |
| `SMTP_HOST`, `SMTP_PORT` | SMTP host/port; 465 uses implicit TLS, otherwise provider STARTTLS configuration |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider credentials, when authentication is required |
| `MAIL_FROM` | Authorized sender name/address |
| `ALLOW_DEMO_SEED` | Must be `true` to enable development seed; false/absent in production |
| `DEMO_PASSWORD` | Locally chosen strong password for all seeded demo accounts; see seed validation |
| `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD` | Temporary first-admin setup values; password at least 16 characters |
| `RUN_INTEGRATION` | `true` enables DB integration tests; never target production |
| `E2E_BASE_URL` | Browser test origin, defaults to localhost:3000 |
| `PLAYWRIGHT_CHANNEL` | Browser channel, defaults to installed `msedge`; CI uses `chromium` |

Without SMTP, development mail goes to ignored `.local/mail/*.json`. These files
contain password-reset links: keep them private and remove expired test mail as
part of local housekeeping. Production has no local-mail fallback.

## Seed or bootstrap

For a development demonstration, set `ALLOW_DEMO_SEED=true` and `DEMO_PASSWORD`
in your private environment, then run `npm run db:seed`. Demo users:

- `owner@fixflow.example`, `owner2@fixflow.example`
- `manager@fixflow.example`
- `technician@fixflow.example`, `technician2@fixflow.example`
- `admin@fixflow.example`

For a new production database, do not seed. Set the three `BOOTSTRAP_*` values and
run `npm run db:bootstrap` once. It refuses if an administrator already exists.
Remove bootstrap credentials afterward. Sign in, create and approve a center,
create its manager, and let that manager configure catalog and technicians.
