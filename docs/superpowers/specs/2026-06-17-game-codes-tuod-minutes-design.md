# Game Codes Registry & TUOD Minutes Settings — Design Spec

> Input for `writing-plans` skill.

**Date:** 2026-06-17  
**Branch:** TBD  
**Scope:** Metadata-only game code registry starting with `tuod`; TUOD timed settings UI in minutes (score-training pattern)

---

## 1. Overview

Games are identified at runtime by **slug** (`ten-up-one-down`, `score-training`, etc.) in URLs, blob keys, API paths, and the component registry. There is no short code or abbreviation layer today.

Ten Up One Down (TUOD) timed settings currently expose play time in **seconds** in the settings form. Score Training already uses **minutes** in the UI and converts to `playtimeSeconds` before POST.

**Goals:**

1. Introduce a shared **game codes registry** — lowercase storage, uppercase display
2. Register `tuod` for `ten-up-one-down` (only entry for now)
3. Change TUOD timed settings form to minutes, matching score-training UX

**Non-goals:**

- Changing slugs, URLs, API paths, or blob keys
- Persisting codes to the blob catalog
- Surfacing `TUOD` in UI yet (registry is infrastructure only)
- Adding codes for other games (`501`, `121`, `score-training`) in this change
- Changing validation, session model, or timer logic (seconds remain canonical internally)

---

## 2. Game codes registry

### Location

`app/src/lib/shared/games/codes.ts`

### API

```ts
export const GAME_CODES: Partial<Record<string, string>> = {
  "ten-up-one-down": "tuod",
};

export function getGameCode(slug: string): string | undefined;
export function formatGameCode(code: string): string;
```

### Conventions

| Concern | Rule |
| ------- | ---- |
| Storage | Lowercase (`"tuod"`) |
| Display | `formatGameCode("tuod")` → `"TUOD"` |
| Missing slug | `getGameCode(slug)` → `undefined` |
| Lookup by code | Not in scope (no reverse lookup helper) |

### Relationship to existing registries

- **`SEED_GAMES` / blob catalog:** unchanged; slug remains canonical identifier
- **`components.ts` registry:** unchanged; still keyed by slug
- **Game codes registry:** additive metadata map; optional per slug

---

## 3. TUOD timed settings (minutes)

Mirror score-training. `playtimeSeconds` stays the canonical stored and validated value.

### UI (`SettingsForm.astro`)

- Label: "Play time (minutes)"
- Input `name="playtimeMinutes"`
- Default: 10, min: 5, max: 30 (inline constants, same as score-training)
- Remove seconds-based input and its imports from constants

### Alpine (`ten-up-one-down.settings.ts`)

In `formDataToSettings`:

- When `key === "playtimeMinutes"`, set `settings.playtimeSeconds = Number(value) * 60`
- Do not include `playtimeMinutes` in the returned settings object

### Unchanged

| Layer | Behavior |
| ----- | -------- |
| `settings.ts` type | `{ endMode: "timed"; playtimeSeconds: number }` |
| `validation.ts` | Validates `playtimeSeconds` against `MIN/MAX_PLAYTIME_SECONDS` |
| `constants.ts` | Keeps second-based defaults and bounds for validation |
| Session / play timer | Operates in seconds |

### Migration

None. Existing sessions already store `playtimeSeconds`.

---

## 4. Testing

### Game codes (`tests/lib/shared/games/codes.test.ts`)

- `getGameCode("ten-up-one-down")` → `"tuod"`
- `getGameCode("score-training")` → `undefined`
- `formatGameCode("tuod")` → `"TUOD"`

### TUOD Alpine settings (`tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts`)

Add test mirroring score-training:

- `formDataToSettings` converts `playtimeMinutes: 10` → `playtimeSeconds: 600`
- Result does not include `playtimeMinutes`

### Unchanged test coverage

- `validation.test.ts` — still validates `playtimeSeconds` bounds
- No new validation or API tests required

---

## 5. File summary

| File | Action |
| ---- | ------ |
| `src/lib/shared/games/codes.ts` | Create |
| `tests/lib/shared/games/codes.test.ts` | Create |
| `src/components/games/ten-up-one-down/SettingsForm.astro` | Modify |
| `src/lib/client/alpine/games/ten-up-one-down.settings.ts` | Modify |
| `tests/lib/client/alpine/games/ten-up-one-down.settings.test.ts` | Modify |
