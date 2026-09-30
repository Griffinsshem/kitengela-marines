# Kitengela Marines FC

The official website and content management system for **Kitengela Marines FC**, a football club from Kitengela, Kajiado County, Kenya. Home of Kitengela Marines (men) and Marines Starlets (women).

- **Site:** <https://kitengela-marines.vercel.app>
- **API:** <https://kitengela-marines-api.onrender.com>

Everything supporters see comes from the database. The club publishes news, squads, fixtures, results, photographs and video through an admin area; no part of the public site is edited by changing code.

---

## How it is put together

Two applications, deployed independently.

| Folder | Contents |
| --- | --- |
| `api/` | Flask 3 + PostgreSQL. All data, authentication and file handling. |
| `web/` | Next.js 16. The public site and the admin area. |
| `docs/` | Project notes. |

They share nothing but the HTTP API. The site can be rebuilt without touching the API, and the API can be used by anything else the club needs later.

### The API

Flask 3, SQLAlchemy 2, PostgreSQL, with Alembic migrations. 23 tables covering the club and its teams, players and staff, competitions, fixtures, results and standings, media, news, sponsors, public submissions, and an audit log.

- **Authentication** is JWT. A short-lived access token is returned in the response body; the refresh token is an HttpOnly cookie with a CSRF double-submit token beside it.
- **Authorisation** is capability-based and scoped per team. A coach of one team cannot edit another team's squad.
- **The audit log** is written by a SQLAlchemy session listener, not by the routes, so no endpoint can forget to record a change.
- **Uploads** are re-encoded on the way in, which strips the GPS coordinates phones record, and capped at 2560px on the long edge.
- **HTML** submitted by editors is sanitised against an allow-list on save *and* again on read.

### The site

Next.js 16 App Router, TypeScript in strict mode, Tailwind v4. Public pages are statically generated and revalidated on a timer; the admin is client-side behind a login.

- **The access token lives in memory only** — never in `localStorage`, so a cross-site scripting bug cannot steal it.
- **Every API response is validated** with zod before it reaches a component.
- **Failures are distinguished from emptiness.** "No fixtures announced" and "the server is not answering" are different sentences, because telling supporters the club has no fixtures when the API is down would be false.
- **Kenyan time is explicit everywhere.** Every date and time is formatted in `Africa/Nairobi`, not the visitor's timezone.

---

## Running it locally

Needs **Python 3.12**, **Node.js 20+** and **PostgreSQL 16**.

### 1. The database

```sql
CREATE USER marines WITH PASSWORD 'marines';
CREATE DATABASE marines_dev OWNER marines;
CREATE DATABASE marines_test OWNER marines;
```

### 2. The API

```bash
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
flask db upgrade
flask seed roles
flask seed categories
flask seed admin --email you@example.com --name "Your Name"
flask --app wsgi run --port 5000
```

Create `api/.env` with at least:

```dotenv
APP_ENV=development
SECRET_KEY=a-long-random-string
JWT_SECRET_KEY=a-different-long-random-string
DATABASE_URL=postgresql+psycopg://marines:marines@localhost:5432/marines_dev
JWT_COOKIE_SECURE=0
CORS_ORIGINS=http://localhost:3000
```

> The `postgresql+psycopg://` prefix is required. The app refuses to start without it rather than guessing a driver.

### 3. The site

```bash
cd web
npm install
npm run dev
```

It expects the API at `http://localhost:5000`; set `NEXT_PUBLIC_API_URL` to point elsewhere.

| URL | What |
| --- | --- |
| <http://localhost:3000> | Public site |
| <http://localhost:3000/admin> | Admin area |

### CLI commands

| Command | Purpose |
| --- | --- |
| `flask seed roles` | Insert the four roles |
| `flask seed categories` | Default news categories |
| `flask seed admin` | Create a Club Admin |
| `flask seed reset-password` | Change a password |

---

## Quality gates

```bash
./check.sh
```

Runs, stopping at the first failure:

| Side | Checks |
| --- | --- |
| `api` | `ruff check`, `ruff format --check`, `mypy app`, `pytest` |
| `web` | `eslint`, `tsc --noEmit`, `vitest run`, `next build` |

Currently **226 API tests** and **26 site tests**. A pre-commit hook runs the same thing.

Two habits that have caught real bugs:

1. **After any backend change**, run `python -c "from app import create_app; create_app()"`. Linting cannot catch an import that does not exist; starting the app can.
2. **After generating a migration**, run `flask db upgrade && flask db downgrade && flask db upgrade`. A broken downgrade is invisible until the day it is needed.

---

## Deployment

| Piece | Where | Notes |
| --- | --- | --- |
| Database | Neon | Free tier does not expire |
| API | Render | Free tier sleeps after 15 minutes |
| Images | Cloudinary | Free tier |
| Site | Vercel | Free tier |

Pushing to `main` deploys both. **Migrations are not run automatically** — apply them from a developer's machine *before* pushing:

```bash
cd api && source .venv/bin/activate
DATABASE_URL="the-neon-url" flask db upgrade
```

That order matters. If the code ships before the column exists, the live site breaks for the minute in between.

### Render settings

| Setting | Value |
| --- | --- |
| Root directory | `api` |
| Build command | `pip install -r requirements.txt` |
| Health check path | `/api/v1/health` |

Start command:

```bash
gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 60 --access-logfile - wsgi:app
```

Environment variables: `APP_ENV=production`, `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `JWT_COOKIE_SECURE=1`, `CORS_ORIGINS`, `API_PUBLIC_URL`, `MEDIA_BACKEND=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

> `CORS_ORIGINS` must be the site's exact origin with no trailing slash. Only the production URL is allowed, so preview deployments cannot reach the live database.

### Vercel settings

Root directory `web`, framework preset **Next.js**, with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL`. Both are compiled into the build, so changing one needs a redeploy.

### The sleeping API

Render's free tier stops the API after fifteen minutes of no traffic, and a cold start takes most of a minute. Two consequences:

- Every page has a loading skeleton, so the wait looks like waiting rather than like nothing happening.
- A failed request is retried once with a longer timeout, because a build that gave up would cache the failure state and serve it to everyone until the page next revalidated.

Around **$7 a month** removes this entirely.

---

## Decisions worth knowing

**Nothing on the public site is hardcoded.** No competition name in an empty state, no player in a component. Everything is data, because the club's circumstances change and a website that needs a developer to say so goes stale.

**Empty states are honest.** A page with no content says what would appear there and why it has not yet. It never implies the club has nothing.

**The public API returns what a page renders, and no more.** Internal ids, draft articles and private player data are absent from public payloads by design, not by filtering in the frontend.

**Deleting is refused rather than cascaded.** A photograph in use, a category with articles, a player with match records: the API says what is in the way instead of quietly taking related data with it.

**Times are stored as instants and shown in Kenyan time.** Kick-off is sent with an explicit `+03:00` offset, because a form that sends a bare time tells every supporter the wrong hour.

**Payment details are published only when the club says so.** Support methods default to inactive. An account number on a public page invites a doctored screenshot with somebody else's number, so the decision stays with the club and needs no code change.

**Motion is driven by scroll position, not JavaScript**, and stops entirely under `prefers-reduced-motion`.

---

## Known gaps

In rough order of how much they matter.

1. **User accounts cannot be created from the admin.** Adding a Team Manager or Media Officer needs `flask seed admin` on a developer's machine. The club cannot delegate without help.
2. **No crest.** The tab icon and share image are generated wordmarks; both are single files to replace once the club supplies one.
3. **Team captain is not modelled.** There is no field, so the site cannot mark one.
4. **Player statistics are only as complete as what is entered.** Line-ups and events are optional, so a rushed entry records only a score.
5. **No email notifications.** Contact and partnership messages are stored and read in the admin. An endpoint that emails on an anonymous request is a way to harass people through the club's own address.
6. **Constraint naming.** No naming convention is configured, so PostgreSQL invents constraint names and Alembic cannot guess them when generating a downgrade. Three migrations needed names added by hand.
7. **The health check does not verify storage.** A wrong Cloudinary credential passes startup and fails at the first upload, where a Media Officer sees only "an unexpected error occurred".

---

## Licence

Copyright Kitengela Marines FC. All rights reserved.
