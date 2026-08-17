# Sid Bollywood — Dance Academy Platform

A production-style, multi-branch dance academy management platform. Real
Postgres database, real JWT auth with RBAC, real APIs, real UI — no mock data
outside the dev seed script.

## Architecture

```
sid-bollywood/
├── apps/
│   ├── api/          FastAPI backend (Python 3.11, SQLAlchemy, Alembic, Postgres)
│   └── web/           Next.js 16 frontend (TypeScript, Tailwind v4, TanStack Query)
├── docker-compose.yml  Postgres + api + web for local/dev
├── .env.example
└── README.md
```

**Backend** (`apps/api`): layered — `api/` (routes) → `services/` (business
logic, permission checks) → `repositories/` (queries) → `models/`
(SQLAlchemy ORM). JWT access + rotating refresh tokens, bcrypt password
hashing, role-based dependencies (`require_roles`) and branch-scoping
(`assert_branch_access`) enforced server-side on every mutating endpoint —
frontend role checks are UX only, never the source of truth.

**Frontend** (`apps/web`): App Router, all pages are client components
talking to the API via TanStack Query + axios (with automatic refresh-token
rotation on 401). Role-based sidebar navigation, six distinct dashboards.

**Database**: 43 tables covering branches/studios, users + role profiles,
courses/batches/class sessions, enrollment, memberships, payments/invoices,
attendance + correction workflow, events/activities/tickets+QR, media/albums
+ approval pipeline, community feed, notifications, learning content,
assessments, certificates, and audit logs. UUID PKs, `created_at`/`updated_at`
on everything, soft-delete (`deleted_at`) where it matters, FK constraints,
indexes on frequently-filtered columns.

## Roles implemented

Super Admin · Admin · Receptionist · Trainer · Student · Photographer — each
with distinct navigation, dashboard, and server-enforced permissions (e.g.
receptionists cannot take attendance; only the assigned trainer can submit
attendance for their own class; only assigned photographers can upload to an
event's media).

## Running it

### Prerequisites
- Docker Desktop (for Postgres)
- Python 3.11+
- Node.js 20+

### 1. Environment

```bash
cp .env.example .env
```

Defaults work out of the box for local dev. Note: Postgres is mapped to host
port **5434** (not 5432) and the API defaults to port **8010** (not 8000) —
this avoids collisions with other Postgres/API instances that may already be
running on your machine. Adjust in `.env` / `docker-compose.yml` if needed.

### 2. Database

```bash
docker compose up -d postgres
```

### 3. Backend

```bash
cd apps/api
python -m venv .venv
./.venv/Scripts/pip install -r requirements/dev.txt   # Windows
# source .venv/bin/activate && pip install -r requirements/dev.txt   # macOS/Linux

./.venv/Scripts/python.exe -m alembic upgrade head
./.venv/Scripts/python.exe scripts/seed.py             # dev-only seed data
./.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

API docs: http://localhost:8010/api/docs

### 4. Frontend

```bash
cd apps/web
npm install
npm run dev
```

App: http://localhost:3000 (redirects to `/login`)

### Or: Docker Compose for everything

```bash
docker compose up -d
```
(Runs migrations manually inside the `api` container the first time:
`docker compose exec api python -m alembic upgrade head && docker compose exec api python scripts/seed.py`)

## Demo accounts

All seeded with password `Welcome@123` (forced change on first login for
staff created via the app; seed accounts are pre-activated for demo
convenience):

| Role | Email |
|---|---|
| Super Admin | superadmin@sidbollywood.com |
| Admin | admin.bh@sidbollywood.com |
| Receptionist | reception.bh@sidbollywood.com |
| Trainer | trainer.arjun@sidbollywood.com |
| Photographer | photo.rahul@sidbollywood.com |
| Student | meher.student@sidbollywood.com |

Seed data also creates 2 branches, a course/level/batch with a recurring
weekly schedule (auto-generated class sessions for 8 weeks), a membership
plan + active membership, a payment + invoice, an academy-wide event with
ticket types, and a welcome feed post.

## Environment variables

See `.env.example` for the full list (database, JWT secrets, storage,
CORS, future Razorpay/SMTP placeholders). Key ones:

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET_KEY` — **change in production**
- `STORAGE_BACKEND=local` — dev uses local disk (`apps/api/storage/`); the
  storage layer (`app/utils/storage.py`) is abstracted so swapping to S3 is
  a matter of implementing the same functions against an S3 client
- `NEXT_PUBLIC_API_URL` — frontend → backend base URL

## Tests

```bash
cd apps/api
./.venv/Scripts/python.exe -m pytest -q
```

18 tests covering: login/refresh/logout, inactive-account rejection,
role-based access denial (receptionist blocked from attendance, trainer
blocked from payments, photographer blocked from student data, only
super admin can create branches, branch-scoped admin rejected outside their
branch, student blocked from viewing another student's profile), and the
full attendance workflow (roster → submit → summary, wrong-trainer
rejection, off-roster student rejection, correction request → admin
approval, attendance-percentage calculation). Tests run against a real
Postgres database (`sidbwood_test`, auto-created) with per-test transaction
rollback — not mocks.

Frontend type-checks clean (`npx tsc --noEmit`) and builds clean
(`npm run build`). The full stack was also driven through a real headless
browser (login → trainer dashboard → today's classes → attendance roster →
mark all present → submit → summary; admin login → dashboard → students
list) with zero console/page errors.

## What's implemented

Every module in the spec has real, working backend APIs (enforced RBAC +
branch isolation) and a real database schema. Frontend UI is complete for:
auth, all 6 dashboards, branches, students (list/detail/register),
trainers, courses/batches (with recurring schedule + auto-generated
sessions, capacity/waitlist), classes, batch detail (roster, enroll,
transfer between batches, waitlist, remove), memberships (plans, assign,
freeze/resume/renew/cancel), payments + revenue summary, the trainer
attendance flow (the spec's highest-priority module — roster,
mark-all-present, per-student status toggles, submit, live summary,
correction request/approval), events with detail pages (ticket types,
student ticket purchase, staff paste-code QR check-in with live
sold/checked-in/no-show/complimentary counts), community feed
(post/like/comment count, official announcements), media (albums, upload,
admin approve/reject queue), and a notification center (list, mark
read/unread, mark-all-read) wired to the topbar bell for every role.

## Known limitations (honest list)

- **Student progress assessments, certificates, and the learning content
  library** have complete, tested backend APIs but no dedicated frontend
  page yet — deprioritized versus the features above per direct user
  request.
- **QR ticket scanning** uses a paste-the-code field, not a camera-based
  scanner — the same `POST /tickets/validate` endpoint a camera scanner
  would call is already wired up and working; only the camera capture UI
  is missing.
- **Class reschedule/cancel** (conflict-checked on the backend) has no
  frontend page yet.
- **Payment gateway** is not integrated — payments are recorded manually
  (cash/UPI/card logged by staff); `app/services/finance.py` is structured
  so a Razorpay adapter can be dropped in without touching callers.
  Payment status is never trusted from the frontend — set server-side only.
  This is standard for a from-scratch pre-launch academy platform, not a
  gap in the payment *recording* system.
- **Image/video processing** does compression + thumbnailing via Pillow
  for photos; video thumbnailing is not implemented (videos are stored
  as-is with no auto-generated poster frame).
  Signed/private URLs are not implemented — the local storage backend
  serves media over a plain static route (`/media-files/...`), fine for
  dev/demo, not for production access control.
- **Push notifications**: in-app notification records + unread badge are
  real; there is no push delivery (architecture supports adding it later
  per the spec's "prepare for future" instruction).
- **Object storage** defaults to local disk in dev per `STORAGE_BACKEND`;
  S3 is not wired up (interface is ready).
- No CI pipeline configured (tests/build are run manually per the commands
  above).

Nothing above is a fake button — every page and control shown in the UI
calls a real, working endpoint. The list above is APIs-without-a-page, not
broken functionality.
