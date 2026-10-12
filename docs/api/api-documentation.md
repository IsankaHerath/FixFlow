# API reference

All paths below are relative to the application origin. Business endpoints return
`{ "data": ... }`; errors return `{ "error": "message" }` (validation errors may
also include field details). Expected statuses include 400 invalid business input,
401 missing session, 403 denied, 404 unavailable resource, 409 conflict and 422
schema validation. Unsupported combinations return 404/405. Auth endpoints use
Better Auth's own response format.

Send `Content-Type: application/json`, the session cookie and an `Origin` exactly
matching `BETTER_AUTH_URL` for business mutations. No bearer API token or public
cross-origin API is implemented. Cron authentication is separate. Dates are ISO
8601; booking dates are interpreted in the center's configured time zone. API
money values are integer minor units (LKR 125.50 = 12550), never floating rupees.

## Public and authentication

| Method/path | Input / behavior |
| --- | --- |
| GET `/api/service-centers[/id]` | Active centers and active services, max 100 |
| GET `/api/appointments/availability` | `centerId`, `serviceId`, `date=YYYY-MM-DD` query parameters |
| POST `/api/auth/sign-up/email` | `name`, `email`, `password`; role is server-controlled CUSTOMER |
| POST `/api/auth/sign-in/email` | `email`, `password`; creates database session cookie |
| POST `/api/auth/sign-out` | Ends current session |
| GET `/api/auth/get-session` | Current Better Auth session |
| POST `/api/auth/request-password-reset` | `email`, `redirectTo: "/reset-password"` |
| POST `/api/auth/reset-password` | `token`, `newPassword`; single-use, revokes existing sessions |

Passwords require 12–128 characters. Auth rate limits are database-backed: five
sign-ins and three sign-ups/reset requests per 60 seconds per limiter key, with
a general 30-request window. Proxy configuration must preserve reliable IP data.

## Customer and shared workspace

| Method/path | Input / access |
| --- | --- |
| GET `/api/workspace?page=1&q=text` | Role-scoped dashboard lists, aggregates and options; lists 20/page |
| GET `/api/vehicles[/id]` | Scoped vehicle array, max 20; latest 30 mileage records |
| POST `/api/vehicles` | Own customer vehicle; fields below |
| PATCH `/api/vehicles/:id` | Full vehicle fields; immutable registration, monotonic mileage |
| DELETE `/api/vehicles/:id` | Archive own vehicle when no active booking |
| POST `/api/appointments` | `vehicleId`, `centerId`, `serviceId`, `startsAt`, `description`, UUID `requestKey` |
| POST `/api/appointments/:id` | Reschedule with booking fields; owner or center manager |
| PATCH `/api/appointments/:id` | `status` and optional `managerNotes` per allowed transitions |
| POST `/api/estimates/:id/decision` | Owner only, `{ "approved": true/false }` |
| GET `/api/invoices/:id/pdf` | Owner or center manager; private PDF download |
| PATCH `/api/profile` | `name`, `phone`, `emailNotifications` for current user |
| PATCH `/api/notifications/:id` | Mark own notification read |
| PATCH `/api/notifications/all` | Mark all own notifications read |
| PATCH `/api/reminders/:id` | Dismiss own reminder |

Vehicle fields: `registration`, `make`, `model`, `year`, `category`, `fuel`,
`transmission`, integer `mileage`; optional `color`, `notes`, `vin`, `engineNumber`.
Allowed enum values and bounds are defined in `src/server/validation.ts`.

## Workshop

GET `/api/reports/export` downloads the monthly revenue/appointment CSV for the
current manager's active centers. Customer, technician and unassigned admin access
is denied. It uses the same 12-month aggregates as the Reports screen.

| Method/path | Input / access |
| --- | --- |
| GET `/api/work-orders/:id` | Owner, assigned technician or center manager; role-specific projection |
| POST `/api/work-orders/:id/assign` | Manager: `technicianId` |
| POST `/api/work-orders/:id/status` | `status`, `note`; assignment, state and role gates |
| POST `/api/work-orders/:id/inspection` | `mileage`, `findings`, `severity`, `checklist` |
| POST `/api/work-orders/:id/task` | `title`, optional `taskId`, `done` |
| POST `/api/work-orders/:id/labor` | `description`, integer `minutes` (1–1440), during approved repair |
| POST `/api/work-orders/:id/estimate` | Manager: items, discount, taxBps, notes, expiresAt |
| POST `/api/work-orders/:id/invoice` | Manager: issue once from approved estimate after clearance |
| POST `/api/invoices/:id/payments` | Manager: `amount`, `method`, `reference`, UUID `requestKey` |
| POST `/api/invoices/:id/void` | Manager: `reason`; unpaid active invoices only |
| POST `/api/inventory` | Manager: `centerId`, `sku`, `name`, `cost`, `price`, `reorderLevel`, optional supplier |
| PATCH `/api/inventory/:id` | Manager: all part fields plus `active`; quantity cannot be edited here |
| POST `/api/inventory/:id/movement` | `delta`, `reason`, UUID `requestKey`, optional workOrderId; technician consumption requires assigned active repair |
| POST `/api/services` | Manager: centerId and service fields |
| PATCH `/api/services/:id` | Manager: centerId and full service fields |
| POST `/api/staff` | name, email, password, phone, centerId, role, specializations; manager creates technician, admin creates manager |
| PATCH `/api/staff/:membershipId` | Own-center manager: technician `active`, `specializations` |
| POST `/api/mileage-correction/:vehicleId` | Manager during own-center active inspection: mileage, reason (10+ characters) |

Estimate items contain `description`, `kind` (PART/LABOR), integer `quantity` and
`unitPrice`. Up to 100 lines, `taxBps` 0–10000 (100 = 1%), nonnegative `discount`
and future ISO `expiresAt`. The service calculates totals; client totals are not
trusted. Payments support CASH, BANK_TRANSFER and OTHER_MANUAL as recorded methods.

Service fields: name, category, description, duration (30–480 minutes, multiple
of 30), startingPrice, nullable intervalKm/intervalMonths and active.

## Platform and scheduling

| Method/path | Input / access |
| --- | --- |
| POST `/api/centers` | Admin: center fields; creates inactive pending-approval center |
| PATCH `/api/centers/:id` | Admin: active boolean, approval timestamp on first activation; manager: own center settings |
| PATCH `/api/users/:id` | Admin: active boolean; cannot deactivate self; suspension deletes sessions |
| POST `/api/cron/reminders` | `Authorization: Bearer CRON_SECRET`; max 500 eligible reminders |
| POST `/api/cron/notifications` | Same cron header; max 50 eligible email notices, max three attempts |

Center fields: name, address, district, province, phone, email, description,
timezone, openHour, closeHour, openDays (0 Sunday to 6 Saturday), capacity and
closures (YYYY-MM-DD strings). Manager settings cannot set approval or active.

## Idempotency and errors

Reuse the same requestKey when retrying the same booking, payment or stock
submission. Do not reuse a key for a different operation. A serialization conflict
returns 409; reload current state before retrying. Invoice creation returns the
existing invoice when already issued. Approval, stock, totals and state checks
always run on the server. This document describes implemented endpoints; no
separate endpoints for list pages, draft autosave, refunds or exports are implied.
