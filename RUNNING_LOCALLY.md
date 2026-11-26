# Running this Documenso instance locally

This is a real, self-hosted checkout of Documenso (not a mock), running so
`engyj-document` (`/home/symits/Data/Projects/engyj-document`) can integrate against
an actual Documenso API instead of its `FakeDocumensoClient` dev stand-in.

## Current status

- Dependencies (Postgres, Redis, inbucket mail, MinIO) run via Docker Compose.
- Database is already migrated (164 migrations applied) and seeded.
- The dev server runs directly with `npm run dev` (not Dockerized) on port 3000.
- `engyj-document/backend/.env` already points at this instance and has a live API
  token — see [Connecting engyj-document](#connecting-engyj-document) below.

## Starting it from scratch

```bash
cd /home/symits/Data/Projects/documenso

# 1. Start dependencies (Postgres, Redis, mail, MinIO)
docker compose -f docker/development/compose.yml up -d database redis inbucket minio

# 2. Apply any pending migrations (safe to re-run; no-ops if already applied)
npm run prisma:migrate-deploy

# 3. Seed demo data (safe to re-run; only seeds if not already present)
npm run prisma:seed

# 4. Start the app
npm run dev
```

The app comes up at **http://localhost:3000**. First boot compiles translations and
the Remix/Vite bundle, so it can take a minute or two before it responds.

> **Note on `gotenberg`:** the compose file also defines a `gotenberg` service (used
> only for converting non-PDF uploads like `.docx` to PDF). Its image build currently
> fails in this environment (an `apt-get install` step for fonts errors out during
> the Docker build — looked like a package/network issue, not a Documenso config
> problem). It's intentionally left out of the `up` command above. Nothing in the
> engyj-document integration needs it (it only ever sends already-generated PDFs),
> so this is safe to ignore unless you need document-conversion support. To retry
> fixing it: `docker compose -f docker/development/compose.yml build gotenberg`.

## Stopping it

```bash
# Stop the dev server
pkill -f "turbo run dev --filter=@documenso/remix"

# Stop dependencies (keeps data in Docker volumes)
cd /home/symits/Data/Projects/documenso
docker compose -f docker/development/compose.yml down
```

## Logging in

The seed script creates these accounts (password for all: `password`):

| Email | Role |
|---|---|
| `admin@documenso.com` | Admin |
| `example@documenso.com` | Regular user |
| `medium-account@documenso.com` | Regular user, pre-populated with sample documents |

Log in at **http://localhost:3000/signin**.

Documenso is organized as Organisation → Team. Each user's personal team has its own
URL slug, e.g. admin's is `personal_kclsxnunwdvssbet`, so their dashboard lives at
`http://localhost:3000/t/personal_kclsxnunwdvssbet/documents`. If you forget the
slug, it's visible in the URL after clicking around the sidebar post-login, or:

```bash
docker exec database psql -U documenso -d documenso -c "
  SELECT u.email, t.url AS team_url FROM \"User\" u
  JOIN \"OrganisationMember\" om ON om.\"userId\" = u.id
  JOIN \"Team\" t ON t.\"organisationId\" = om.\"organisationId\"
  WHERE u.email = 'admin@documenso.com';
"
```

## Creating an API token (for integrating another app)

API tokens are per-team. In the UI: log in → **Settings → API Tokens**
(`/t/<team-url>/settings/tokens`) → **Create token** → give it a name, set an
expiry (or "Never") → **Create token**. The plaintext token is shown **once** —
copy it immediately, it can't be viewed again afterward.

The API base URL for the legacy v1 REST API (what engyj-document's
`HttpDocumensoClient` talks to) is `http://localhost:3000/api/v1`.

## Connecting engyj-document

`engyj-document/backend/.env` is already configured:

```
DOCUMENSO_API_URL=http://localhost:3000/api/v1
DOCUMENSO_API_KEY=api_h8g4zdlpq5qqynbm
```

That key belongs to a token named `engyj-document-integration`, created under
`admin@documenso.com`'s personal team, set to never expire. If it's ever revoked,
generate a new one (steps above) and update `DOCUMENSO_API_KEY`, then restart the
engyj-document backend + queue worker so the new `.env` value is picked up:

```bash
cd /home/symits/Data/Projects/engyj-document/backend
pkill -f "artisan serve --port=8001"; pkill -f "artisan queue:work"
PHP_INI_SCAN_DIR=":$(pwd)/.dev-php-conf.d" php artisan serve --port=8001 --no-reload > /tmp/backend.log 2>&1 &
php artisan queue:work > /tmp/queue.log 2>&1 &
```

`AppServiceProvider` in engyj-document auto-switches from `FakeDocumensoClient` to
`HttpDocumensoClient` the moment `DOCUMENSO_API_KEY` is non-empty — no code changes
needed, just the `.env` value.

## ✅ Fixed: the applicant now signs on Documenso's real hosted page

Originally, engyj-document's applicant-facing `/signature` step captured a drawn
signature **locally** and immediately marked the document `completed` in its own
database, regardless of which client was active. Against `FakeDocumensoClient` that
was fine (it's a paired fake). Against this real instance it did nothing on the
Documenso side — the document stayed `PENDING`/`NOT_SIGNED` there while
engyj-document's own record said `completed`, and the "signed" PDF that got stored
was just the unsigned draft byte-for-byte (verified with a live test document,
Documenso id `1020`).

This is now fixed:

- `HttpDocumensoClient::getStatus()` / `FakeDocumensoClient::getStatus()` return
  each recipient's `signing_url` (real Documenso-hosted page, or `null` in fake
  mode) — persisted to a new `recipients.documenso_signing_url` column by
  `DocumensoService::syncStatus()`, which now also correctly maps Documenso's raw
  `signingStatus` vocabulary (`NOT_SIGNED`/`SIGNED`/`REJECTED`) onto engyj-document's
  own `recipients.status` enum instead of writing it through unchanged (that direct
  write was itself a latent bug - it would have failed against a real instance's
  status strings).
- `SignController::show()`/`status()` expose `documenso_signing_url` to the
  frontend; `SignFlow.tsx` and `PdfSignFlow.tsx` redirect the applicant there
  (`window.location.href`) instead of rendering the local signature pad, whenever
  one is present.
- `SignController::signature()` (the local pad endpoint) now hard-rejects with 409
  against any non-`FakeDocumensoClient` document — it can no longer fake completion
  against a real instance again.
- `status()` also triggers `DocumensoService::syncStatus()` on every poll while a
  document is `sent`/`partially_signed`, and finalizes (`downloadAndStoreFinal` +
  transition to `completed`) once Documenso reports every required recipient
  signed - a fallback path independent of the webhook, per
  `DocumensoService::syncStatus()`'s own "webhooks must never be the only source of
  truth" design.

There's also already a **live webhook subscription** on this Documenso instance
(team id 4, admin@documenso.com's personal team) pointing at
`http://local.engyj.com:8001/api/v1/webhooks/documenso` (`local.engyj.com` resolves
to `127.0.0.1` via `/etc/hosts`, and is allow-listed in Documenso's
`NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS` since it'd otherwise look like a
private-network SSRF target) - subscribed to `DOCUMENT_SENT`, `DOCUMENT_OPENED`,
`DOCUMENT_SIGNED`, `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED`,
`RECIPIENT_EXPIRED`. This was set up in an earlier session, not by this fix, and
it's genuinely firing (`WebhookEvent` rows + `ProcessDocumensoWebhookJob` runs
confirmed below) - so completion detection actually has two independent paths
working together, exactly as the codebase's own doc comments intend.

**Verified end-to-end against this real instance**: created a document via the
Recruit API → filled the applicant form → redirected to
`http://localhost:3000/sign/<token>` → completed real signing there (typed
signature, confirmed) → Documenso reported `"status": "COMPLETED"`,
`"signingStatus": "SIGNED"` → the real webhook fired (`DOCUMENT_SENT` →
`DOCUMENT_OPENED` → `DOCUMENT_SIGNED` → `DOCUMENT_COMPLETED`, all processed by
`ProcessDocumensoWebhookJob`) and engyj-document's status poll both independently
confirmed it, downloaded the real signed PDF (1.24MB, includes Documenso's own
signing certificate/audit page - confirmed different MD5 from the 878KB unsigned
draft) and transitioned to `completed`.

## Useful local endpoints

| What | URL |
|---|---|
| Documenso app | http://localhost:3000 |
| Documenso API (v1) | http://localhost:3000/api/v1 |
| Inbucket (dev mail catcher — view "sent" emails) | http://localhost:9010 |
| MinIO console (uploaded file storage) | http://localhost:9011 (user/pass: `documenso` / `password`) |
| Postgres | `postgres://documenso:password@127.0.0.1:54320/documenso` |
