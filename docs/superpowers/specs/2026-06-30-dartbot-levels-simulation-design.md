# DartBot Levels & Simulation — Design Spec

> Input for `writing-plans` skill. Supersedes level-system sections of `2026-06-29-dartbot-design.md` (levels 1–15, `hitAccuracy`/`missSpread` model).

**Date:** 2026-06-30  
**Scope:** `lib/shared/dartbot/` — level profiles, throw engines, validation, settings preview  
**Approach:** Split data + engines (#2) — anchor tables at L1/L5/L10, interpolate L2–4 and L6–9

---

## 1. Problem

Current DartBot simulation does not match desired play feel or stat targets:

| Issue | Current behavior |
| ----- | ---------------- |
| Level cap | 1–15 with anchor at L15 |
| Checkout % | `checkout.successRate` is display/validation only — not used in throws |
| Throw model | Single `hitAccuracy` + uniform geometric `adjacent` misses for trebles and doubles alike |
| Scoring aim | T20-first; beginners should aim **S20** with realistic scatter |
| Checkout rates | L10 configured ~55%; should be 30–50% range; L1 should be 8–30% |

**Goal:** Per-level fixed outcome distributions for scoring and doubles; stat ranges as indications (not guarantees); cap at level 10.

---

## 2. Stat definitions

| Stat | Meaning |
| ---- | ------- |
| **3-dart average** | Expected scoring level over time from current configuration. Indicates strength; actual results vary with checkout situations, target preference, and normal game variance. |
| **Scoring average** | Expected average points per scoring visit. Indication only — true scores deviate during play. |
| **Checkout percentage** | How often DartBot successfully finishes when throwing at a double. Higher = more dependable finishes. Formula: `checkouts / dartsOnDouble` (matches 501 summary `checkoutPercentage`). Displayed and validated as a **min–max range** per level. |

---

## 3. Level stat ranges (all levels)

| Lvl | 3-dart avg | Scoring avg | Checkout % |
| --- | ---------- | ----------- | ---------- |
| 1 | 30–40 | 37–47 | 8–30 |
| 2 | 33–43 | 40–50 | 10–30 |
| 3 | 37–47 | 43–53 | 10–35 |
| 4 | 41–51 | 45–55 | 15–35 |
| 5 | 45–55 | 48–58 | 15–40 |
| 6 | 48–58 | 53–63 | 20–40 |
| 7 | 52–62 | 57–67 | 20–45 |
| 8 | 56–66 | 60–70 | 25–45 |
| 9 | 64–74 | 68–78 | 30–50 |
| 10 | 67–77 | 75–85 | 30–50 |

---

## 4. Data model

Replace `LevelProfile` execution fields (`hitAccuracy`, `missSpread`, `checkoutDiscipline`, `checkout.successRate`) with distribution-based profiles.

```ts
/** Segment label → weight (%). Must sum to 100. */
type ScoringOutcomes = Record<string, number>;

type DoubleOutcomes = {
  hit: number;
  inside: number;           // same-number single (e.g. D20 → S20)
  neighborSingle: number;   // split uniformly among board neighbors
  neighborDouble: number;   // split uniformly among neighbor doubles
  outside: number;          // score 0
  other: number;            // rare off-route segment
};

type LevelProfile = {
  level: number;
  threeDartAverage: { min: number; max: number };
  scoringAverage: { min: number; max: number };
  checkoutPercentage: { min: number; max: number };
  scoring: {
    /** UI/metadata: primary scoring intent */
    aim: "S20" | "T20";
    outcomes: ScoringOutcomes;
  };
  doubles: {
    outcomes: DoubleOutcomes;
  };
};

type SkillProfile = LevelProfile; // level field always set
```

**Removed from simulation:** `hitAccuracy`, `missSpread`, `checkout.successRate` as throw knobs.

**Optional retention:** `checkoutDiscipline` on `CheckoutPolicy` only (route quality selection). May be derived from level (e.g. `level / 10`) — not a separate user-facing stat.

**Level cap:** `getSkillProfile(level)` accepts integers **1–10** only.

---

## 5. File layout (split data + engines)

```text
lib/shared/dartbot/
├── level-profiles.ts       # ANCHOR_PROFILES (L1, L5, L10) + LEVEL_STAT_RANGES
├── interpolate-levels.ts   # buildLevelProfile(level) — lerp + normalize
├── levels.ts               # getSkillProfile() public entry (re-exports)
├── scoring-throw.ts        # sample scoring outcome from distribution
├── double-throw.ts         # sample double outcome + resolve to segment
├── throw-engine.ts         # dispatch: scoring vs double by intent
├── dart-bot.ts             # simulateVisit (unchanged pipeline, new throws)
├── miss-resolver.ts        # REMOVE or replace with double-throw resolution
├── route-engine.ts         # REMOVE scoring target selection (table replaces it)
└── checkout/               # unchanged planner/policy/knowledge
```

**Barrel:** `index.ts` continues exporting `getSkillProfile`, `simulateVisit`, etc.

---

## 6. Anchor scoring distributions (authoritative)

Weights are **landing** percentages per dart during a scoring visit. Sum = 100.

### Level 1 — aim `S20`

| Segment | % |
| ------- | - |
| S20 | 35 |
| T20 | 3 |
| D20 | 4 |
| S5 | 15 |
| S1 | 15 |
| T5 | 3 |
| D5 | 4 |
| T1 | 3 |
| D1 | 4 |
| outside | 6 |
| other | 8 |

### Level 5 — aim `S20`

| Segment | % |
| ------- | - |
| S20 | 50 |
| T20 | 8 |
| D20 | 2 |
| S5 | 7 |
| S1 | 7 |
| T5 | 5 |
| D5 | 2 |
| T1 | 5 |
| D1 | 2 |
| outside | 6 |
| other | 6 |

### Level 10 — aim `T20`

| Segment | % |
| ------- | - |
| S20 | 40 |
| T20 | 15 |
| D20 | 9 |
| S5 | 5 |
| S1 | 5 |
| T5 | 10 |
| D5 | 1 |
| T1 | 10 |
| D1 | 1 |
| outside | 2 |
| other | 2 |

### `other` (scoring)

Weighted mix of off-bed singles/trebles not in the main table (e.g. S3, T19, S7). Fixed pool in `scoring-throw.ts`; same pool all levels; only weight varies. Avg score ~10–15 for calibration tests.

### `outside`

Score 0. Segment label `"outside"` (existing convention in tests/UI if any; else score-0 sentinel).

---

## 7. Anchor double distributions (authoritative)

Resolved **relative to aimed double** from checkout planner. Sum = 100.

### Level 1

| Bucket | % |
| ------ | - |
| hit | 14 |
| inside | 36 |
| neighborSingle | 24 |
| neighborDouble | 7 |
| outside | 14 |
| other | 5 |

### Level 5

| Bucket | % |
| ------ | - |
| hit | 24 |
| inside | 30 |
| neighborSingle | 20 |
| neighborDouble | 10 |
| outside | 9 |
| other | 7 |

### Level 10

| Bucket | % |
| ------ | - |
| hit | 38 |
| inside | 26 |
| neighborSingle | 14 |
| neighborDouble | 10 |
| outside | 7 |
| other | 5 |

### Double resolution rules

Given target double segment (e.g. `D20`, base 20):

| Bucket | Resolution |
| ------ | ---------- |
| hit | target double |
| inside | single same number (`S20` / `20`) |
| neighborSingle | uniform among board neighbors (`S5`, `S1` for 20) |
| neighborDouble | uniform among neighbor doubles (`D5`, `D1`) |
| outside | score 0 |
| other | uniform from small off-route pool (e.g. `D10`, `D12`) |

Bull finishes (`50`): only `hit` → bull; `inside` → `25`; `outside` → 0; no neighbor buckets.

---

## 8. Interpolation (levels 2–4, 6–9)

**Algorithm:**

1. For scoring: lerp each outcome weight between adjacent anchors, renormalize to sum 100, round to integers (largest-remainder method so sum = 100).
2. For doubles: lerp each bucket weight, renormalize to sum 100.
3. For `aim`: L1–5 → `S20`; L6–10 → `T20` (L6+ shifts intent toward treble scoring).
4. Stat ranges (3DA, scoring avg, checkout %): **explicit per level** from §3 — not interpolated.

**Anchor pairs:**

| Levels | Interpolate between |
| ------ | ------------------- |
| 2, 3, 4 | L1 ↔ L5 (`t = (level - 1) / 4`) |
| 6, 7, 8, 9 | L5 ↔ L10 (`t = (level - 5) / 5`) |

### Draft interpolated scoring tables

Values below are initial implementation targets; Monte Carlo may require ±1% tweaks.

**Level 2** (t=0.25 L1→L5): S20 39, T20 4, D20 3, S5 13, S1 13, T5 4, D5 3, T1 4, D1 3, outside 6, other 8

**Level 3** (t=0.5): S20 43, T20 6, D20 3, S5 11, S1 11, T5 4, D5 3, T1 4, D1 3, outside 6, other 7

**Level 4** (t=0.75): S20 46, T20 7, D20 2, S5 9, S1 9, T5 5, D5 2, T1 5, D1 2, outside 6, other 6

**Level 6** (t=0.2 L5→L10): S20 48, T20 9, D20 3, S5 7, S1 7, T5 6, D5 2, T1 6, D1 2, outside 5, other 5

**Level 7** (t=0.4): S20 46, T20 11, D20 5, S5 6, S1 6, T5 7, D5 2, T1 7, D1 2, outside 4, other 4

**Level 8** (t=0.6): S20 44, T20 12, D20 6, S5 6, S1 6, T5 8, D5 1, T1 8, D1 1, outside 3, other 3

**Level 9** (t=0.8): S20 42, T20 14, D20 8, S5 5, S1 5, T5 9, D5 1, T1 9, D1 1, outside 2, other 2

### Draft interpolated double tables

**Level 2:** hit 17, inside 35, neighborSingle 23, neighborDouble 8, outside 13, other 5

**Level 3:** hit 19, inside 33, neighborSingle 22, neighborDouble 9, outside 12, other 6

**Level 4:** hit 22, inside 31, neighborSingle 21, neighborDouble 9, outside 10, other 7

**Level 6:** hit 27, inside 29, neighborSingle 19, neighborDouble 10, outside 9, other 6

**Level 7:** hit 30, inside 28, neighborSingle 18, neighborDouble 10, outside 8, other 6

**Level 8:** hit 33, inside 27, neighborSingle 16, neighborDouble 10, outside 8, other 6

**Level 9:** hit 36, inside 26, neighborSingle 15, neighborDouble 10, outside 7, other 5

---

## 9. Throw engines

### Scoring (`scoring-throw.ts`)

```ts
function throwScoringDart(profile: SkillProfile, rng: Rng): Segment
```

1. Build cumulative distribution from `profile.scoring.outcomes`.
2. Sample `rng.next()` → segment label.
3. `outside` → score-0 segment; `other` → sample from off-bed pool.
4. Return `parseSegment(label)`.

**No `chooseScoringTarget`** during scoring visits — distribution fully defines landing.

### Doubles (`double-throw.ts`)

```ts
function throwDoubleDart(target: Segment, profile: SkillProfile, rng: Rng): Segment
```

1. Sample bucket from `profile.doubles.outcomes`.
2. Resolve bucket to concrete segment relative to `target` (§7 rules).
3. Return segment.

### Dispatch (`throw-engine.ts`)

```ts
function throwDart(target: Segment, profile: SkillProfile, intent: ThrowIntent, rng: Rng): Segment
```

- `intent === "score"` → `throwScoringDart` (ignores planner target; always 20-bed distribution)
- `intent === "checkout"` → `throwDoubleDart(target, ...)` when target is double/bull
- `intent === "setup"` → `throwSetupDart(target, profile, rng)` — aims planner segment (e.g. `T19`, `S16`):
  - **hit** → land on `target`
  - **neighbor** → uniform among `target.adjacent`
  - **outside** → score 0
  - Hit rate per level = `scoring.outcomes[target.label]` if present, else sum of same-ring weights for `target.base` (e.g. for `T19` use `T19` weight or interpolate from anchor tables). Remainder splits: 70% neighbor / 30% outside.

### `simulateVisit` changes

- Remove `chooseScoringTarget` call for scoring intent.
- Pass `intent` into `throwDart`.
- Keep checkout planner, strategy engine, bust/checkout rules unchanged.

---

## 10. Strategy & checkout (unchanged)

- `strategy-engine.ts` — intent selection (score / setup / checkout) unchanged.
- `checkout/` — planner, policy, knowledge unchanged.
- `CheckoutPolicy` — optionally derive discipline from `level / 10` instead of profile field.

---

## 11. Validation & testing

### Monte Carlo (new / updated tests)

Per level 1–10, simulate ≥500 scoring visits and ≥500 double attempts:

| Assert | Tolerance |
| ------ | --------- |
| Scoring average | within level `scoringAverage` range |
| 3-dart average (full leg sim) | within `threeDartAverage` range |
| Checkout % (`hits on double / attempts`) | within `checkoutPercentage` range |

Use fixed seeds for deterministic regression subsets; wider seeds for range checks.

### Unit tests

- `scoring-throw.test.ts` — distribution sampling sums, outside/other resolution
- `double-throw.test.ts` — neighbor resolution for D20, bull edge case
- `interpolate-levels.test.ts` — L2/L4/L6/L9 weights sum to 100; monotonic hit% increases
- Update `levels.test.ts` — cap at 10, anchor exact match
- Update `dart-bot.test.ts` — remove L15 references; level 2 expects S20-heavy outcomes
- Remove / update `throw-engine.test.ts` hitAccuracy tests

### Runtime validation (`501.play.ts`)

`validateMatchStats` updated:

- `checkoutRate` → compare against `checkoutPercentage.min/max`
- `checkoutPercentage` display uses range string `"8–30%"`

### Settings preview (`preview.ts`)

```ts
checkoutSuccessRate: `${min}–${max}%`
```

---

## 12. Consumer updates

| File | Change |
| ---- | ------ |
| `games/501/validation.ts` | `level <= 10` |
| Settings UI / PlayerPicker | Slider max 10 |
| `statistics-engine.ts` | Range-based checkout validation |
| `AGENTS.md` | Level cap 10, new file layout note |

---

## 13. Out of scope

- Mid-match stat convergence / runtime adjustment
- New checkout routes
- DartBot DB persistence
- UI animation timing changes
- User player simulation (human input unchanged)

---

## 14. Success criteria

1. Levels 1–10 only; L1/L5/L10 scoring tables match §6 exactly.
2. Scoring visits sample from per-level fixed distributions (no geometric random scatter).
3. Double attempts sample from per-level bucket distributions wired to checkout % ranges.
4. Monte Carlo tests pass for all 10 levels within configured ranges.
5. Settings preview shows stat ranges including checkout % band.
