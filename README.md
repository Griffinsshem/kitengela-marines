# Kitengela Marines — Club Platform

Official digital home of **Kitengela Marines** (senior men) and **Marines Starlets**
(women), Kitengela, Kajiado County, Kenya.

- `web/` — Next.js, React, TypeScript, Tailwind. Deploys to Vercel.
- `api/` — Flask, PostgreSQL, SQLAlchemy, JWT. Deploys to Render.
- `docs/` — architecture, schema and design notes.

The two applications share nothing at runtime except a versioned REST contract
under `/api/v1`, so each deploys, tests and scales on its own.

## Ground rules

- **Real data > filled space.** No invented players, results, standings,
  sponsors, founding dates or statistics. Missing data gets a designed
  empty state.
- **Authorisation lives on the server.** Frontend route guards are UX only.
- **No production secrets in the repo.** `.env.example` documents the shape;
  real values live in Vercel and Render environment settings.

## Quality gates

Every feature step leaves these green before the next one starts.

| check | `web/` | `api/` |
|---|---|---|
| lint | `npm run lint` | `ruff check .` |
| types | `npm run typecheck` | `mypy app` |
| tests | — | `pytest` |
| build | `npm run build` | — |
