# Logout Button — Brainstorming Context

> Living document for handoff between agents/context windows. Updated after each brainstorming decision.

**Status:** Brainstorming — UI shape decided; remaining questions open  
**Last updated:** 2026-06-13  
**Branch:** `login-interface` (inherits login feature work)

---

## User Request

Create a **logout button component** that:

1. **Properly logs out the user** — ends the session via the existing auth system
2. **Is reusable** — drop-in across pages/layouts as the codebase scales
3. **Follows the current application** — same patterns, conventions, and stack as the login feature

---

## Project Snapshot


| Item             | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Stack            | Astro 6, Tailwind CSS 4, Alpine.js 3, TypeScript                                |
| Hosting          | Netlify (Functions)                                                             |
| Auth session     | `iron-session` signed HTTP-only cookie (`dart-counter-session`, 30-day max age) |
| Route protection | `app/src/middleware.ts` — unauthenticated users → `/login?redirect=<path>`      |
| Layout           | `app/src/layouts/BaseLayout.astro` (no nav/header yet)                          |
| Related context  | `docs/superpowers/context/login-feature-context.md`                             |
| Related spec     | `docs/superpowers/specs/2026-06-13-login-design.md`                             |


---

## Feature Scope (from user)


| In scope                                    | Out of scope (unless decided later)                |
| ------------------------------------------- | -------------------------------------------------- |
| Reusable logout button component            | Signup / account management                        |
| Client-side logout action (POST → redirect) | Server-side changes to logout API (already exists) |
| Consistent with login UI patterns           | Multi-user / role-based logout                     |


---

## Existing Building Blocks

Logout backend is **already implemented** by the login feature. UI was explicitly deferred.


| Asset                     | Path                                               | Notes                                                           |
| ------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Logout API                | `app/src/pages/api/auth/logout.ts`                 | `POST` → `session.destroy()` → `{ ok: true }`                   |
| Logout API tests          | `app/tests/api/auth/logout.test.ts`                | Verifies session destruction                                    |
| Session helper            | `app/src/lib/server/auth/session.ts`               | `getSession()`, `SessionData`, cookie config                    |
| Login client pattern      | `app/src/lib/client/alpine/forms/login.form.ts`    | Alpine factory + `fetch` + `ApiResponse` + `t(code)`            |
| Alpine registry           | `app/src/lib/client/alpine/app.factory.ts`         | `Alpine.data("loginForm", loginForm)`                           |
| UI primitive — button     | `app/src/components/ui/PrimaryBtn.astro`           | Submit button, loading spinner, `:aria-busy`                    |
| UI primitive — input      | `app/src/components/ui/Input.astro`                | Labeled input                                                   |
| Feature component pattern | `app/src/components/forms/LoginForm.astro`         | Composes `ui/` primitives + Alpine `x-data`                     |
| API response type         | `app/src/lib/shared/api/types.ts`                  | `{ ok: boolean; code?: MessageCode }`                           |
| i18n                      | `app/src/lib/shared/i18n/index.ts`                 | `t(code)`                                                       |
| Error codes               | `app/src/lib/shared/constants/errors.constants.ts` | `MessageCode`, `errorMessages`                                  |
| Theme tokens              | `app/src/styles/global.css`                        | Semantic `@theme` colors (`surface-`*, `accent`, `error`, etc.) |


### Logout API contract (current)

```
POST /api/auth/logout
→ 200 { ok: true }
→ session cookie destroyed
```

No request body. No error codes defined for logout today.

---

## Conventions to Follow (from login feature)

Inherited from approved login decisions — treat as constraints unless user overrides:


| Area             | Convention                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Component layers | `components/ui/` = primitives; feature/auth components compose primitives                            |
| Client logic     | Alpine factories in `lib/client/alpine/`; register in `app.factory.ts`; no `<script>` in `.astro`    |
| Styling          | Semantic Tailwind tokens from `global.css`; no raw hex in components                                 |
| Containers       | `@container` on component root in `src/components/`; container query variants (`@sm:`) for internals |
| Pages            | Thin shells — layout + import component; viewport utilities only                                     |
| API client       | `fetch` → typed `ApiResponse` → redirect or `t(code)` on error                                       |
| Loading state    | Spinner on button; label hidden while loading (`PrimaryBtn` pattern)                                 |
| Errors           | Inline text below control; `role="alert"` + `aria-live="polite"`                                     |
| Testing          | Vitest + TDD; `tests/` mirrors `lib/` structure                                                      |
| Verification     | `npm run check` → `npm test` → `npm run build`                                                       |


---

## Decisions Log


| #   | Topic             | Question                  | Answer                                                                                                   |
| --- | ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | UI — control type | Button style?             | **Icon button** — no visible text label; accessible name via `aria-label`                                |
| 2   | UI — icon         | Which icon?               | **Custom SVG** — logout/exit arrow (Material-style); see [UI Design](#ui-design)                         |
| 3   | UI — icon color   | Icon color?               | **Tailwind `sky` palette** — e.g. `text-sky-400` default, `hover:text-sky-300` (exact shade TBD at spec) |
| 4   | Icons — folder    | Where do SVG assets live? | `**src/icons/`** — top-level alongside `components/` and `lib/`; logout SVG at `src/icons/logout.svg`    |


---

## UI Design

### Control type

Icon-only button. Not `PrimaryBtn` (submit + full-width pill). Likely a new `IconBtn` primitive in `components/ui/` or icon-button styling inline on `LogoutBtn.astro`.

### Icon SVG

User-provided logout icon. Stored as `**app/src/icons/logout.svg**` (not under `components/`).

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M0 0h24v24H0z" fill="none" />
  <path fill="currentColor" d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h7v2zm11-4l-1.375-1.45l2.55-2.55H9v-2h8.175l-2.55-2.55L16 7l5 5z" />
</svg>
```

- `fill="currentColor"` — color inherited from parent `text-sky-*` on the button
- `width/height="1em"` — scales with button font size
- `aria-hidden="true"` when embedded in a labeled button; button carries `aria-label="Logout"` (or i18n string)
- Import in `LogoutBtn.astro` via `@icons/logout.svg` (add `@icons/*` → `./src/icons/*` path alias in `tsconfig.json`)

### Color

Tailwind built-in `**sky**` range (not current semantic `accent` tokens):


| State              | Utility (draft)                   |
| ------------------ | --------------------------------- |
| Default            | `text-sky-400`                    |
| Hover              | `text-sky-300`                    |
| Disabled / loading | `text-sky-400/50` or `opacity-50` |


Note: login feature prefers semantic `@theme` tokens elsewhere; this component uses `sky-*` per user request. Can map to semantic tokens later (`--color-icon-logout`) if palette consistency becomes a concern.

### Accessibility


| Requirement     | Approach                                                                    |
| --------------- | --------------------------------------------------------------------------- |
| Visible label   | None — icon only                                                            |
| Accessible name | `aria-label` on `<button>`                                                  |
| Loading         | `:aria-busy="loading"`; optional spinner replacing icon                     |
| Focus           | Visible focus ring (e.g. `focus-visible:ring-2 focus-visible:ring-sky-400`) |


---

## Open Questions (pending user input)

Brainstorming will resolve these one at a time:

1. **Component placement** — `LogoutBtn.astro` in `components/ui/` vs `components/auth/`?
2. **Post-logout redirect** — always `/login`, `/`, or configurable prop?
3. **Error handling** — show inline error on network failure, or silent retry/toast?
4. **Loading UX** — spinner replaces icon, or overlay on icon button?
5. **First integration point** — where is the button first mounted? (`BaseLayout`, `index.astro`, future nav?)

---

## Anticipated File Targets

```
app/
├── src/
│   ├── icons/
│   │   └── logout.svg              # logout icon SVG (user-provided)
│   ├── components/
│   │   └── ui/
│   │       └── LogoutBtn.astro     # TBD — icon button + Alpine; imports 
│   ├──icons/
|   |   └──logout.svg
│   ├── lib/
│   │   └── client/
│   │       └── alpine/
│   │           ├── app.factory.ts    # register logout factory
│   │           └── forms/ or auth/   # TBD — logout.form.ts (or similar)
│   └── layouts/
│       └── BaseLayout.astro          # possible first consumer
└── tests/
    └── lib/client/alpine/...        # TBD — logout factory tests
```

**Path alias (anticipated):** `@icons/`* → `./src/icons/*` in `tsconfig.json`

No server-side file changes expected unless logout API contract needs extension.

---

## Related Docs


| Doc                         | Path                                                |
| --------------------------- | --------------------------------------------------- |
| Login brainstorming context | `docs/superpowers/context/login-feature-context.md` |
| Login design spec           | `docs/superpowers/specs/2026-06-13-login-design.md` |
| Login implementation plan   | `docs/superpowers/plans/2026-06-13-login.md`        |


---

## Next Steps

1. Brainstorming — clarifying questions, approaches, design approval
2. Write spec → `docs/superpowers/specs/YYYY-MM-DD-logout-button-design.md`
3. User reviews spec
4. Invoke `writing-plans` skill

