# Neon Dev Branching Design

**Date:** 2026-06-19  
**Status:** Approved (user-requested full pipeline: spec → plan → implement)

## Problem

`npm run dev` uses `DATABASE_URL` from `.env`, which points at the Neon **production** branch. Local development can mutate production data, and feature work cannot be isolated per git branch.

Neon supports instant copy-on-write branches, but nothing in the dev workflow provisions or selects one automatically.

## Goal

When a developer runs `npm run dev`, the app transparently:

1. Creates or checks out a Neon branch matching the current git branch
2. Writes that branch's connection strings (and Neon Auth URLs) to `.env.local`
3. Applies pending Drizzle migrations on that branch
4. Starts the Astro dev server against the isolated database

Production deploys (`npm run build`, Netlify) remain unchanged — they use platform env vars, not `.env.local`.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Branch naming | Sanitized git branch name; `main` / `master` → `dev`; detached/no git → `dev` |
| Branch parent | Neon default branch (`production`) via `neonctl checkout` (creates from parent when missing) |
| Env target | `.env.local` via `neonctl env pull --file .env.local` (never overwrite production creds in `.env`) |
| CLI | `npx neonctl@latest` (no global install) |
| Project link | Existing `app/.neon` (`projectId`, `orgId`) |
| Migrations | Run `npm run db:migrate` after env pull (idempotent) |
| Opt-out | `SKIP_NEON_DEV_BRANCH=1` skips provisioning; `CI=true` skips automatically |
| Scope | Dev server only; `db:migrate`, `db:generate`, `seed:auth` unchanged (use active `.env.local` when present) |

## Approaches Considered

### A. `predev` shell one-liner (rejected)

```json
"predev": "neonctl checkout ..."
```

**Pros:** Minimal files.  
**Cons:** No git-branch sanitization, no migrate step, hard to test, `predev` also runs for `npm run dev -- --host` edge cases awkwardly.

### B. Dev wrapper script + env override fix (recommended)

`scripts/dev.ts` calls `ensure-neon-dev-branch.ts`, then spawns `astro dev`. Fix `bootstrap-env.ts` so `.env.local` overrides `.env`.

**Pros:** Testable branch naming, explicit migrate, clear opt-out, matches Neon branch-first loop.  
**Cons:** Two small scripts.

### C. Git post-checkout hook (rejected)

Auto-provision on every `git checkout`.

**Pros:** Branch always in sync with git.  
**Cons:** Surprising side effects, doesn't help first `npm run dev`, worktree complexity; out of scope.

**Recommendation:** **B**

## Architecture

```
npm run dev
  └─ scripts/dev.ts
       ├─ ensure-neon-dev-branch.ts (skip if CI / SKIP_NEON_DEV_BRANCH)
       │    ├─ resolveNeonDevBranchName()  ← git branch → Neon branch name
       │    ├─ neonctl branches create (if missing; required in non-interactive mode)
       │    ├─ neonctl checkout <name> --no-env-pull
       │    ├─ neonctl env pull --file .env.local
       │    └─ npm run db:migrate
       └─ spawn astro dev (stdio inherit)

bootstrap-env.ts (existing, fixed)
  .env → .env.local → .env.development → .env.development.local
  (later files override earlier keys)
```

### Branch name resolution

| Git branch | Neon branch |
| ---------- | ----------- |
| `main` | `dev` |
| `master` | `dev` |
| `feature/foo` | `feature-foo` |
| `performance-optimizations` | `performance-optimizations` |
| (not a git repo) | `dev` |

Sanitization: lowercase; replace `/` and invalid chars with `-`; collapse repeated `-`; trim leading/trailing `-`; max 63 chars.

### Env layering

| File | Role | Git |
| ---- | ---- | --- |
| `.env` | Production / shared Neon credentials (current) | ignored |
| `.env.local` | Active dev branch credentials (neonctl env pull) | ignored (add to `.gitignore`) |
| `.env.example` | Documented template | committed |

`bootstrap-env.ts` must let `.env.local` override `.env` so dev branch URLs take effect.

### Neon variables pulled

Per `neonctl env pull`: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_DATA_API_URL` (when provisioned).

## Error Handling

| Failure | Behavior |
| ------- | -------- |
| Not authenticated (`neonctl me` fails) | Print message to run `npx neonctl auth`; exit 1 |
| Missing `.neon` | Print message to run `npx neonctl link`; exit 1 |
| `checkout` / `env pull` fails | Exit 1 with stderr; do not start dev server |
| `db:migrate` fails | Exit 1; branch is checked out but schema may be stale |
| Opt-out env set | Skip Neon steps; run `astro dev` directly |

## Testing

| Layer | What |
| ----- | ---- |
| Unit | `resolveNeonDevBranchName()` — git branch → Neon name table |
| Manual | `npm run dev` on a feature branch creates Neon branch + `.env.local`; SSR uses isolated DB |

No integration test against live Neon in CI (requires API key + network).

## Out of Scope

- `neon.ts` branch TTL / autoscaling policy
- Git hooks / worktree automation
- Changing Netlify production env
- `@neondatabase/env` runtime injection (`neon-env run`) — file-based pull is sufficient for Astro dev

## Files

| File | Action |
| ---- | ------ |
| `app/src/lib/server/neon-dev-branch.ts` | Create — branch name resolver |
| `app/scripts/ensure-neon-dev-branch.ts` | Create — checkout + env pull + migrate |
| `app/scripts/dev.ts` | Create — dev entrypoint |
| `app/src/lib/server/bootstrap-env.ts` | Modify — `.env.local` overrides `.env` |
| `app/package.json` | Modify — `dev` script |
| `app/.gitignore` | Modify — ignore `.env.local` |
| `app/.env.example` | Modify — document dev branching |
| `app/tests/lib/server/neon-dev-branch.test.ts` | Create — unit tests |
