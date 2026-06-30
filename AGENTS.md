# Agent Guide — Dart Counter

Conventions for AI agents and contributors working in this repo. Application code lives in `app/`.

---

## `lib/shared` module structure

Every feature module under `app/src/lib/shared/` should follow this layout:

```text
<module>/
  types.ts      # stable domain types
  index.ts      # public barrel (types + functions + constants)
  *.ts          # logic files (private helpers stay unexported)
```

**Pilot modules (barrels complete):** `games/501`, `dartbot`
**Pending rollout:** `games/score-training`, `games/singles-training`, `games/ten-up-one-down`, other shared subsystems

When editing a module that already has a barrel, follow the rules below. When creating a new module, set up `types.ts` and `index.ts` from the start.

---

## Type placement (hybrid rule)

### Put in `types.ts`

Stable data shapes that describe the module's domain:

- Session, GameState, PlayerState, VisitRecord
- Settings and player config types
- Summary and stats types
- Enums/unions shared across multiple files in the module

### Keep with logic

Types tied to a single function's return shape:

- `ValidateSettingsResult` → next to `validateSettings()`
- `ValidateCompletedResult` → next to `validateCompletedSession()`

Re-export result types from `index.ts` so external consumers still have one import path.

### Type guards

Stay in the file that implements the runtime check (e.g. `isFiveOhOneSession`). Re-export via `index.ts`.

---

## Import rules

### External consumers

Pages, components, `lib/client`, `lib/server`, and other `lib/shared` modules import from the **barrel only**:

```ts
import {
  buildFiveOhOneSession,
  type FiveOhOneSession,
} from "@lib/shared/games/501";
```

Do **not** import from deep paths like `@lib/shared/games/501/session-factory` in external files. ESLint blocks this for pilot modules.

### Internal files (inside the module)

Use **relative sibling imports** only:

```ts
import type { FiveOhOneSettings } from "./settings";
import { STARTING_SCORE } from "./constants";
import type { FiveOhOneSession } from "./types";
```

Never import your own barrel from inside the module. Never use `@lib/shared/<your-module>/...` absolute paths for siblings.

### Cross-module

Import from the other module's barrel:

```ts
import { simulateVisit, type SimulatedVisit } from "@lib/shared/dartbot";
```

---

## Adding a new game module

1. Create `app/src/lib/shared/games/<slug>/types.ts` with domain types.
2. Implement logic in focused files (`session.ts`, `settings.ts`, `validation.ts`, …).
3. Create `index.ts` exporting the public API (types, factories, validators, constants needed outside).
4. Keep private helpers (internal match math, classifiers, estimates) out of the barrel.
5. External code imports only from `@lib/shared/games/<slug>`.
6. Add ESLint boundary rule when the module is complete.

Mirror an existing pilot module (`games/501`) for structure and naming.

---

## `index.ts` barrel guidelines

Export:

- All public types (from `types.ts` + result types from validation/completion files)
- Factory/builder functions (`buildSession`, `parseFormData`)
- Validators called from pages or API routes
- Constants needed by client UI or API handlers

Do **not** export:

- Internal helpers consumed only by sibling files in the same module
- Subsystem internals (e.g. `dartbot/checkout/*` classes)

---

## Path aliases

Defined in `app/tsconfig.json`:

| Alias           | Path                   |
| --------------- | ---------------------- |
| `@lib/*`        | `app/src/lib/*`        |
| `@components/*` | `app/src/components/*` |
| `@api/*`        | `app/src/pages/api/*`  |
| `@tests/*`      | `app/tests/*`          |

---

## Verification

After changes to shared modules:

```bash
cd app
npm run check
npm test
npx fallow # important to check if files are actually redundant, e.g. app.factory.ts is used in astro.config.mjs but is marked as unused
npm run lint
```

---

## Related docs

- Design spec: `docs/superpowers/specs/2026-06-30-module-barrels-types-design.md`
- Rollout handoff: `docs/superpowers/context/module-barrels-types-handoff.md`
- Feature specs: `docs/superpowers/specs/`
