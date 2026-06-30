# DartBot Levels & Simulation — Design Spec

> Input for `writing-plans` skill. Supersedes level-system sections of `2026-06-29-dartbot-design.md` (levels 1–15, `hitAccuracy`/`missSpread` model).

**Date:** 2026-06-30
**Scope:** `lib/shared/dartbot/`, `lib/shared/darts/checkout-hints.data.ts` (safer-route tuning)
**Approach:** Split data + engines (#2) — anchor tables at L1/L5/L10, interpolate L2–4 and L6–9

---

## 1. Problem

Current DartBot simulation does not match desired play feel or stat targets:

| Issue            | Current behavior                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Level cap        | 1–15 with anchor at L15                                                                  |
| Checkout %       | `checkout.successRate` is display/validation only — not used in throws                   |
| Throw model      | Single `hitAccuracy` + uniform geometric `adjacent` misses for trebles and doubles alike |
| Scoring aim      | T20-first; beginners should aim **S20** with realistic scatter                           |
| Checkout routing | Multi-route JSON selection; does not match player `getCheckoutHint()`                    |
| Setup throws     | No per-level accuracy when aiming singles/trebles/bull for checkout setup                |
| Checkout rates   | L10 configured ~55%; should be 30–50% range; L1 should be 8–30%                          |

**Goal:** Per-level fixed outcome distributions for scoring, setup, and doubles; checkout replanning via player hints; stat ranges as indications (not guarantees); cap at level 10.

---

## 2. Stat definitions

| Stat                    | Meaning                                                                                                                                                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3-dart average**      | Expected scoring level over time from current configuration. Indicates strength; actual results vary with checkout situations, target preference, and normal game variance.                                                                                                                          |
| **Scoring average**     | Expected average points per scoring visit. Indication only — true scores deviate during play.                                                                                                                                                                                                        |
| **Checkout percentage** | How often DartBot successfully finishes when throwing at a double. Formula: `checkouts / dartsOnDouble` (matches 501 summary `checkoutPercentage`). Displayed and validated as a **min–max range** per level. Per double attempt, a dedicated function picks a hit rate within that range (see §11). |
| **Deviation**           | Independent **below** / **above** (points) per stat at **leg** and **set** scope. Leg bands wider than set. Low levels balanced; high levels skewed upward. See §3.                                                                                                                                  |
| **Soft convergence**    | When running **set** stats leave the set deviation band, apply a minimal hit-rate nudge on subsequent throws. Leg-level variance unchanged. See §3.4.                                                                                                                                                |

---

## 3. Level stat ranges (all levels)

### Target bands

| Lvl | 3-dart avg | Scoring avg | Checkout % |
| --- | ---------- | ----------- | ---------- |
| 1   | 30–40      | 37–47       | 8–30       |
| 2   | 33–43      | 40–50       | 10–30      |
| 3   | 37–47      | 43–53       | 10–35      |
| 4   | 41–51      | 45–55       | 15–35      |
| 5   | 45–55      | 48–58       | 15–40      |
| 6   | 48–58      | 53–63       | 20–40      |
| 7   | 52–62      | 57–67       | 20–45      |
| 8   | 56–66      | 60–70       | 25–45      |
| 9   | 64–74      | 68–78       | 30–50      |
| 10  | 67–77      | 75–85       | 30–50      |

UI shows target bands only (`min–max`). Checkout % has no deviation bands (per-dart hit rate handles variance).

### Deviation bands

Each of **scoring average** and **3-dart average** has independent `below` / `above` (points) at **leg** and **set** scope.

**Validation:**

```text
leg pass:  min - deviation.leg.below  ≤ actual  ≤  max + deviation.leg.above
set pass:  min - deviation.set.below  ≤ actual  ≤  max + deviation.set.above
```

**Rules:**

1. `leg.below` ≥ `set.below` and `leg.above` ≥ `set.above` (leg may swing wider than set).
2. Low levels: `below ≈ above` (balanced).
3. High levels: `above > below` (more upside than downside).
4. Anchors at L1, L5, L10; interpolate L2–4 and L6–9 (lerp per field).

#### Anchor deviation — scoring average (points)

| Lvl | leg below | leg above | set below | set above |
| --- | --------- | --------- | --------- | --------- |
| 1   | 6         | 6         | 4         | 4         |
| 5   | 6         | 8         | 4         | 5         |
| 10  | 6         | 12        | 4         | 8         |

#### Anchor deviation — 3-dart average (points)

| Lvl | leg below | leg above | set below | set above |
| --- | --------- | --------- | --------- | --------- |
| 1   | 5         | 5         | 3         | 3         |
| 5   | 5         | 7         | 3         | 4         |
| 10  | 5         | 10        | 3         | 6         |

#### Draft interpolated deviation — scoring average

| Lvl | leg − | leg + | set − | set + |
| --- | ----- | ----- | ----- | ----- |
| 2   | 6     | 6     | 4     | 4     |
| 3   | 6     | 7     | 4     | 4     |
| 4   | 6     | 7     | 4     | 5     |
| 6   | 6     | 9     | 4     | 6     |
| 7   | 6     | 10    | 4     | 6     |
| 8   | 6     | 11    | 4     | 7     |
| 9   | 6     | 12    | 4     | 8     |

#### Draft interpolated deviation — 3-dart average

| Lvl | leg − | leg + | set − | set + |
| --- | ----- | ----- | ----- | ----- |
| 2   | 5     | 5     | 3     | 3     |
| 3   | 5     | 6     | 3     | 3     |
| 4   | 5     | 6     | 3     | 4     |
| 6   | 5     | 8     | 3     | 4     |
| 7   | 5     | 8     | 3     | 5     |
| 8   | 5     | 9     | 3     | 5     |
| 9   | 5     | 10    | 3     | 6     |

**Match planner:** `generateMatchPlan` leg targets use `threeDartAverage.deviation.leg` (asymmetric offset: sample below/above separately) instead of legacy `execution.variance`.

### Soft set-level convergence (hybrid)

**Pre-match (primary):** `MatchPlanner` leg targets + fixed per-level throw tables (§6–8).

**Mid-set (secondary, minimal):** When running **set** stats exit the **set deviation band**, nudge hit probabilities slightly on the next throws until stats re-enter the band. Leg-level stats are **not** corrected — a single hot/cold leg stays realistic.

**Tracked stats (current set):**

- Running 3-dart average
- Running scoring average (scoring visits only)
- Running checkout % (`checkouts / dartsOnDouble`)

**Trigger:** After each bot visit, recompute set stats. If **any** tracked stat is outside its set band (`!isWithinStatBand(actual, range, 'set')`), enable convergence for subsequent bot throws in that set.

**Nudge mechanics:**

| Direction | Condition | Effect |
| --------- | --------- | ------ |
| Boost | Stat below `min - set.below` | Shift weight from miss buckets → `hit` (scoring/setup/doubles) |
| Trim | Stat above `max + set.above` | Shift weight from `hit` → miss buckets |

**Caps (must feel realistic):**

| Parameter | L1 | L5 | L10 | Rule |
| --------- | -- | -- | --- | ---- |
| `maxScoringHitShift` (% pts) | 1.5 | 2.5 | 3.5 | Max added to intended scoring bed (S20/T20) per visit |
| `maxSetupHitShift` (% pts) | 2 | 3 | 4 | Max added to setup `hit` bucket |
| `maxCheckoutHitShift` (% pts) | 2 | 3 | 4 | Max added to double `hit` rate from `checkoutHitRateForDart` |
| `distanceScale` | 0.15 | 0.2 | 0.25 | `shift = min(maxShift, distanceOutsideBand * distanceScale)` |

- Interpolate L2–4, L6–9 between anchors.
- **Never** force a hit; only redistribute existing bucket weights.
- **Never** change aim segment or checkout hint — routing stays player-parity.
- **Never** nudge when all set stats are inside set bands (`shift = 0`).
- One stat out of band may nudge only the relevant throw type (low 3DA → scoring; low checkout % → doubles).

**Forbidden (still out of scope):** large rubber-banding, leg-level convergence, artificial visit scores, forced checkouts, shifts above `max*HitShift`.

```ts
type ConvergenceConfig = {
  maxScoringHitShift: number;
  maxSetupHitShift: number;
  maxCheckoutHitShift: number;
  distanceScale: number;
};

type SetRunningStats = {
  dartsThrown: number;
  scoringVisitCount: number;
  threeDartAverage: number;
  scoringAverage: number;
  checkoutPercentage: number; // 0 when no double attempts
  doubleAttempts: number;
  checkouts: number;
};

type ConvergenceBias = {
  scoringHitShift: number;   // %-points added to S20/T20 (or aim bed)
  setupHitShift: number;
  checkoutHitShift: number;
};

function computeConvergenceBias(
  stats: SetRunningStats,
  profile: SkillProfile,
): ConvergenceBias;
```

**Session state:** extend `FiveOhOneBotState` with `setRunningStats` (reset on new set). Recomputed after each bot visit via existing visit history for the set.

**Visibility:** convergence is invisible to the player — no UI indicator. Optional `console.debug` in dev when bias ≠ 0.

## 4. Data model

Replace `LevelProfile` execution fields (`hitAccuracy`, `missSpread`, `checkoutDiscipline`, `checkout.successRate`) with distribution-based profiles.

```ts
/** Segment label → weight (%). Must sum to 100. */
type ScoringOutcomes = Record<string, number>;

type SetupOutcomes = {
  hit: number;
  neighborSingle?: number; // singles setup only
  neighborTreble?: number; // trebles setup only
  wrongRing: number; // same base, wrong ring (e.g. T12 when aiming S12)
  neighborWrongRing: number; // board-neighbor numbers, wrong ring
  outside: number;
  other: number;
};

type BullSetupOutcomes = {
  hit: number;
  wrongRing: number; // 25 when aiming 50, 50 when aiming 25
  outside: number;
  other: number;
};

type DoubleOutcomes = {
  hit: number;
  inside: number;
  neighborSingle: number;
  neighborDouble: number;
  outside: number;
  other: number;
};

type DeviationBand = {
  below: number; // max points under min (positive magnitude)
  above: number; // max points over max (positive magnitude)
};

type StatRange = {
  min: number;
  max: number;
  deviation: {
    leg: DeviationBand;
    set: DeviationBand;
  };
};

type LevelProfile = {
  level: number;
  threeDartAverage: StatRange;
  scoringAverage: StatRange;
  checkoutPercentage: { min: number; max: number };
  scoring: {
    aim: "S20" | "T20";
    outcomes: ScoringOutcomes;
  };
  setup: {
    singles: SetupOutcomes;
    trebles: SetupOutcomes;
    outerBull: BullSetupOutcomes;
    bull: BullSetupOutcomes;
  };
  doubles: {
    outcomes: DoubleOutcomes;
  };
  convergence: ConvergenceConfig;
};

type SkillProfile = LevelProfile;
```

**Removed from simulation:** `hitAccuracy`, `missSpread`, `checkout.successRate`, `checkoutDiscipline` as throw/route knobs.

**Level cap:** `getSkillProfile(level)` accepts integers **1–10** only.

**Board neighbors:** All neighbor resolution uses `BOARD_ORDER` in `segments.ts` (e.g. base 12 → neighbors **5 and 14**, not 20).

---

## 5. File layout (split data + engines)

```text
lib/shared/dartbot/
├── level-profiles.ts       # ANCHOR_PROFILES (L1, L5, L10) + LEVEL_STAT_RANGES
├── interpolate-levels.ts   # buildLevelProfile(level) — lerp + normalize
├── levels.ts               # getSkillProfile() public entry
├── scoring-throw.ts        # scoring-visit distribution sampling
├── setup-throw.ts          # setup singles/trebles/bull distribution sampling
├── double-throw.ts         # double-finish distribution sampling
├── checkout-hit-rate.ts    # per-dart double hit rate within checkout % range
├── stat-validation.ts      # isWithinStatBand, computeConvergenceBias
├── set-stats.ts            # aggregate SetRunningStats from visit history
├── convergence.ts          # apply hit shifts to outcome tables
├── throw-engine.ts         # dispatch by intent + target ring
├── checkout-target.ts      # getCheckoutHint(remaining) → next aim segment
├── dart-bot.ts             # simulateVisit with per-dart replanning
├── miss-resolver.ts        # REMOVE
├── route-engine.ts         # REMOVE
└── checkout/               # knowledge retained for 131–170 setup zone only
```

---

## 6. Anchor scoring distributions (authoritative)

Weights are **landing** percentages per dart during a scoring visit. Sum = 100.

### Level 1 — aim `S20`

| Segment | %   |
| ------- | --- |
| S20     | 35  |
| T20     | 3   |
| D20     | 4   |
| S5      | 15  |
| S1      | 15  |
| T5      | 3   |
| D5      | 4   |
| T1      | 3   |
| D1      | 4   |
| outside | 6   |
| other   | 8   |

### Level 5 — aim `T20`

| Segment | %   |
| ------- | --- |
| S20     | 50  |
| T20     | 8   |
| D20     | 2   |
| S5      | 7   |
| S1      | 7   |
| T5      | 7   |
| D5      | 2   |
| T1      | 7   |
| D1      | 2   |
| outside | 3   |
| other   | 5   |

### Level 10 — aim `T20`

| Segment | %   |
| ------- | --- |
| S20     | 30  |
| T20     | 31  |
| D20     | 9   |
| S5      | 3   |
| S1      | 3   |
| T5      | 10  |
| D5      | 1   |
| T1      | 10  |
| D1      | 1   |
| outside | 1   |
| other   | 1   |

### `other` (scoring)

Weighted mix of off-bed singles/trebles (e.g. S3, T19, S7). Fixed pool in `scoring-throw.ts`.

### `outside`

Score 0.

---

## 7. Anchor setup distributions (authoritative)

Used when `intent === "setup"` or `intent === "checkout"` on a **non-double** target. Sum = 100 per table.

### Setup singles (e.g. aim S12 — neighbors S5, S14)

| Bucket            | L1  | L5  | L10 |
| ----------------- | --- | --- | --- |
| hit               | 16  | 38  | 58  |
| neighborSingle    | 26  | 22  | 16  |
| wrongRing         | 24  | 18  | 12  |
| neighborWrongRing | 22  | 14  | 8   |
| outside           | 8   | 5   | 4   |
| other             | 4   | 3   | 2   |

**Resolution (aim S12):**

| Bucket            | Lands on                   |
| ----------------- | -------------------------- |
| hit               | S12                        |
| neighborSingle    | S5, S14 (uniform)          |
| wrongRing         | T12, D12 (uniform)         |
| neighborWrongRing | D5, T5, D14, T14 (uniform) |
| outside           | score 0                    |
| other             | off-bed pool               |

### Setup trebles (e.g. aim T14 — neighbor trebles T11, T9)

| Bucket            | L1  | L5  | L10 |
| ----------------- | --- | --- | --- |
| hit               | 12  | 28  | 48  |
| neighborTreble    | 22  | 20  | 18  |
| wrongRing         | 32  | 22  | 14  |
| neighborWrongRing | 20  | 16  | 10  |
| outside           | 10  | 8   | 6   |
| other             | 4   | 6   | 4   |

**Resolution (aim T14):**

| Bucket            | Lands on                   |
| ----------------- | -------------------------- |
| hit               | T14                        |
| neighborTreble    | T11, T9 (uniform)          |
| wrongRing         | S14, D14 (uniform)         |
| neighborWrongRing | D11, S11, D9, S9 (uniform) |
| outside           | score 0                    |
| other             | off-bed pool               |

### Outer bull (aim 25)

Low levels rarely miss the board entirely on bull attempts — `other` (near-miss on board) is far more common than `outside`.

| Bucket           | L1  | L5  | L10 |
| ---------------- | --- | --- | --- |
| hit              | 14  | 28  | 45  |
| wrongRing (→ 50) | 8   | 12  | 15  |
| outside          | 6   | 8   | 8   |
| other            | 72  | 52  | 32  |

### Bull (aim 50)

| Bucket           | L1  | L5  | L10 |
| ---------------- | --- | --- | --- |
| hit              | 14  | 26  | 40  |
| wrongRing (→ 25) | 36  | 28  | 26  |
| outside          | 8   | 8   | 6   |
| other            | 42  | 38  | 28  |

---

## 8. Anchor double distributions (authoritative)

Resolved relative to aimed double from checkout hint. Sum = 100.

### Level 1

| Bucket         | %   |
| -------------- | --- |
| hit            | 14  |
| inside         | 20  |
| neighborSingle | 30  |
| neighborDouble | 12  |
| outside        | 19  |
| other          | 5   |

### Level 5

| Bucket         | %   |
| -------------- | --- |
| hit            | 24  |
| inside         | 25  |
| neighborSingle | 15  |
| neighborDouble | 15  |
| outside        | 16  |
| other          | 5   |

### Level 10

| Bucket         | %   |
| -------------- | --- |
| hit            | 38  |
| inside         | 15  |
| neighborSingle | 10  |
| neighborDouble | 15  |
| outside        | 20  |
| other          | 2   |

### Double resolution rules

Given target double (e.g. `D20`, base 20):

| Bucket         | Resolution                     |
| -------------- | ------------------------------ |
| hit            | target double                  |
| inside         | single same number             |
| neighborSingle | uniform among board neighbors  |
| neighborDouble | uniform among neighbor doubles |
| outside        | score 0                        |
| other          | off-route pool                 |

---

## 9. Interpolation (levels 2–4, 6–9)

**Algorithm:**

1. Lerp each weight in scoring, setup (all four tables), and doubles between anchors.
2. Renormalize to sum 100; round via largest-remainder.
3. `aim`: L1–5 → `S20`; L6–10 → `T20`.
4. Stat ranges: explicit per level from §3 — not interpolated.

| Levels     | Interpolate between              |
| ---------- | -------------------------------- |
| 2, 3, 4    | L1 ↔ L5 (`t = (level - 1) / 4`)  |
| 6, 7, 8, 9 | L5 ↔ L10 (`t = (level - 5) / 5`) |

### Draft interpolated scoring tables

**L2:** S20 39, T20 4, D20 3, S5 13, S1 13, T5 4, D5 3, T1 4, D1 3, outside 6, other 8
**L3:** S20 43, T20 6, D20 3, S5 11, S1 11, T5 4, D5 3, T1 4, D1 3, outside 6, other 7
**L4:** S20 46, T20 7, D20 2, S5 9, S1 9, T5 5, D5 2, T1 5, D1 2, outside 6, other 6
**L6:** S20 48, T20 9, D20 3, S5 7, S1 7, T5 6, D5 2, T1 6, D1 2, outside 5, other 5
**L7:** S20 46, T20 11, D20 5, S5 6, S1 6, T5 7, D5 2, T1 7, D1 2, outside 4, other 4
**L8:** S20 44, T20 12, D20 6, S5 6, S1 6, T5 8, D5 1, T1 8, D1 1, outside 3, other 3
**L9:** S20 42, T20 14, D20 8, S5 5, S1 5, T5 9, D5 1, T1 9, D1 1, outside 2, other 2

### Draft interpolated double tables

**L2:** hit 17, inside 35, neighborSingle 23, neighborDouble 8, outside 13, other 5
**L3:** hit 19, inside 33, neighborSingle 22, neighborDouble 9, outside 12, other 6
**L4:** hit 22, inside 31, neighborSingle 21, neighborDouble 9, outside 10, other 7
**L6:** hit 27, inside 29, neighborSingle 19, neighborDouble 10, outside 9, other 6
**L7:** hit 30, inside 28, neighborSingle 18, neighborDouble 10, outside 8, other 6
**L8:** hit 33, inside 27, neighborSingle 16, neighborDouble 10, outside 8, other 6
**L9:** hit 36, inside 26, neighborSingle 15, neighborDouble 10, outside 7, other 5

### Draft interpolated setup singles

**L2:** hit 22, neighborSingle 25, wrongRing 23, neighborWrongRing 20, outside 7, other 3
**L3:** hit 27, neighborSingle 24, wrongRing 21, neighborWrongRing 18, outside 6, other 4
**L4:** hit 33, neighborSingle 23, wrongRing 20, neighborWrongRing 16, outside 5, other 3

### Draft interpolated setup trebles

**L2:** hit 16, neighborTreble 22, wrongRing 29, neighborWrongRing 19, outside 9, other 5
**L3:** hit 20, neighborTreble 21, wrongRing 27, neighborWrongRing 18, outside 9, other 5
**L4:** hit 24, neighborTreble 21, wrongRing 25, neighborWrongRing 17, outside 8, other 5

---

## 10. Checkout routing & replanning

### Source of truth: `getCheckoutHint(remaining)`

In checkout range (≤170, finishable), DartBot uses `getCheckoutHint(remaining)` from `@lib/shared/darts` — the same route shown to the player. No multi-route JSON selection via `CheckoutPolicy` in checkout range.

**Per-dart replanning:** After every dart, recalculate `remaining` and call `getCheckoutHint(remaining)` again. First segment of the returned route is the next aim.

### Example: 74 with misses

| Dart     | Remaining | Hint          | Aim     | Rationale                                                      |
| -------- | --------- | ------------- | ------- | -------------------------------------------------------------- |
| 1        | 74        | T14 → D16     | T14     | Standard hint                                                  |
| Miss S14 | 60        | 20 → D20      | S20     | Replan: leave D20                                              |
| Miss S5  | 55        | **S15 → D20** | **S15** | Safer than T15; bigger target; miss inside 20 still leaves D20 |

**Hint data update required:** Change `checkout-hints.data.ts` entry for **55** from `["T15", "D5"]` to `["15", "D20"]`. Audit other hints for similar safer-single preference where a wide single leaves a standard double (implementation task).

### Target selection per intent

```ts
function nextCheckoutTarget(remaining: number): Segment | null {
  const hint = getCheckoutHint(remaining);
  if (!hint?.segments[0]) return null;
  return parseSegment(hint.segments[0]);
}
```

- First segment of current hint = aim for this dart.
- If segment is a double/bull and bot is on finish dart → `intent === "checkout"` → `double-throw`.
- If segment is single/treble → `intent === "setup"` → `setup-throw` by ring type.

### 131–170 setup zone

`strategy-engine.ts` unchanged: below level 8 may prefer `setup` over `checkout` in 131–170. Setup targets still from `getCheckoutHint` when finishable, or best setup route evaluator for high leaves (existing `evaluateSetupRoute`).

---

## 11. Throw engines

### Scoring (`scoring-throw.ts`)

`throwScoringDart(profile, bias, rng)` — sample `profile.scoring.outcomes`, apply `bias.scoringHitShift` to aim bed weight (renormalize).

### Setup (`setup-throw.ts`)

`throwSetupDart(target, profile, bias, rng)` — pick table by target ring; apply `bias.setupHitShift` to `hit` bucket.

| Target ring  | Table                     |
| ------------ | ------------------------- |
| single       | `profile.setup.singles`   |
| triple       | `profile.setup.trebles`   |
| outer (`25`) | `profile.setup.outerBull` |
| bull (`50`)  | `profile.setup.bull`      |

Resolve buckets relative to `target` using §7 rules and `segments.ts` neighbors.

### Per-dart checkout hit rate (`checkout-hit-rate.ts`)

Each double attempt gets its **own** hit probability within the level's checkout % range. Rates differ per dart in the same visit (e.g. dart 1 → 10%, dart 2 → 23%, dart 3 → 17% on a level 1 bot with range 8–30%).

```ts
/**
 * Returns hit probability for one double attempt (0–1).
 * Always within [checkoutPercentage.min, checkoutPercentage.max] / 100.
 * Sampled independently per call so consecutive darts in a visit can differ.
 */
function checkoutHitRateForDart(
  profile: SkillProfile,
  dartIndexInVisit: 1 | 2 | 3,
  rng: Rng,
): number;
```

**Algorithm:**

1. `min = profile.checkoutPercentage.min / 100`, `max = profile.checkoutPercentage.max / 100`.
2. `rate = min + rng.next() * (max - min)` — uniform in range.
3. Optional: `dartIndexInVisit` may seed a sub-range or stratified slice so darts 1–3 spread across the band (implementation choice; must stay within [min, max]).

**Wiring into** `throwDoubleDart`**:**

1. `hitRate = checkoutHitRateForDart(profile, dartIndex, rng) + bias.checkoutHitShift / 100` (clamp to checkout % range).
2. Scale base `profile.doubles.outcomes` miss buckets proportionally so `hit = hitRate * 100` (percent) and all buckets sum to 100.
3. Sample bucket, resolve segment per §8.

**Match-level checkout %** still aggregates across all double attempts; long-run Monte Carlo should land inside `checkoutPercentage` range (validation uses range only, not per-dart rates).

### Doubles (`double-throw.ts`)

`throwDoubleDart(target, profile, dartIndexInVisit, rng)` — dynamic hit rate from `checkoutHitRateForDart`, then sample scaled `profile.doubles.outcomes`; resolve per §8.

### Dispatch (`throw-engine.ts`)

```ts
function throwDart(
  target: Segment,
  profile: SkillProfile,
  intent: ThrowIntent,
  rng: Rng,
): Segment;
```

| Intent     | Engine                                           |
| ---------- | ------------------------------------------------ |
| `score`    | `throwScoringDart`                               |
| `setup`    | `throwSetupDart(target, ...)`                    |
| `checkout` | `throwDoubleDart(target, dartIndexInVisit, ...)` |

### `simulateVisit` changes

1. Before visit: `bias = computeConvergenceBias(setRunningStats, profile)`.
2. Each dart: `remaining` → `nextCheckoutTarget(remaining)` or scoring distribution if `intent === "score"`.
3. Pass `intent` and `bias` into `throwDart`.
4. After each dart: update `remaining`; if still in visit, replan from hint.
5. After visit applied: update `setRunningStats`.
6. Remove `chooseScoringTarget`, `CheckoutPlanner` for checkout-range targets.

---

## 12. Validation & testing

### Monte Carlo

Per level 1–10: ≥500 scoring visits, ≥500 setup throws, ≥500 double attempts. Simulate multi-leg sets.

| Assert          | Scope | Pass condition                                      |
| --------------- | ----- | --------------------------------------------------- |
| Scoring average | leg   | `isWithinStatBand(actual, scoringAverage, 'leg')`   |
| Scoring average | set   | `isWithinStatBand(actual, scoringAverage, 'set')`   |
| 3-dart average  | leg   | `isWithinStatBand(actual, threeDartAverage, 'leg')` |
| 3-dart average  | set   | `isWithinStatBand(actual, threeDartAverage, 'set')` |
| Checkout %      | match | within `checkoutPercentage` range                   |

```ts
function isWithinStatBand(
  actual: number,
  range: StatRange,
  scope: "leg" | "set",
): boolean {
  const d = range.deviation[scope];
  return actual >= range.min - d.below && actual <= range.max + d.above;
}
```

### Unit tests

- `convergence.test.ts` — zero bias inside set band; boost when below; trim when above; shift capped at `max*HitShift`; leg outside / set inside → no bias
- `set-stats.test.ts` — aggregates 3DA, scoring avg, checkout % per set
- `checkout-hit-rate.test.ts` — each returned rate ∈ [min, max]; three calls in one visit can differ
- `setup-throw.test.ts` — S12 neighbors are S5/S14; T14 neighbor trebles; bull other > outside at L1
- `checkout-target.test.ts` — replan 74→60→55 uses S15 on third dart after hint update
- `scoring-throw.test.ts`, `double-throw.test.ts`, `interpolate-levels.test.ts`
- Update `dart-bot.test.ts` — replanning visit on 74 with seeded misses
- `checkouts.test.ts` — `getCheckoutHint(55)` → `["15", "D20"]`

### Settings preview

```ts
checkoutSuccessRate: `${min}–${max}%`;
```

---

## 13. Consumer updates

Always prioritize single to double over aiming at tripple leaving a smaller double as per e.g. below. Include a full checkout-hints audit beyond 61 + obvious safer-single cases.

| File                           | Change                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `darts/checkout-hints.data.ts` | 55 → `["15", "D20"]`; audit safer singles                                                |
| `games/501/validation.ts`      | `level <= 10`                                                                            |
| Settings UI                    | Slider max 10                                                                            |
| `statistics-engine.ts`         | Range-based checkout validation; `isWithinStatBand` for scoring/3DA at leg and set scope |
| `match-planner.ts`             | Asymmetric leg targets from `threeDartAverage.deviation.leg`                             |
| `501/bot-helpers` / session types | `setRunningStats` on `FiveOhOneBotState`; reset on new set                            |
| `501.play.ts`                  | Recompute set stats after bot visit; pass bias into simulation                           |
| `AGENTS.md`                    | Level cap 10, new dartbot file layout                                                    |

---

## 14. Out of scope

- **Aggressive** stat rubber-banding (shifts above `max*HitShift`, forced outcomes, leg-level convergence)
- DartBot DB persistence
- UI animation timing

---

## 15. Success criteria

1. Levels 1–10 only; L1/L5/L10 scoring, setup, and double tables match §6–8.
2. Scoring visits use fixed 20-bed distributions.
3. Setup visits use per-level singles/trebles/bull tables with `neighborWrongRing`.
4. Checkout range uses `getCheckoutHint` with per-dart replanning (player parity).
5. `getCheckoutHint(55)` is `S15 → D20`; 74 miss example routes correctly.
6. Bull setup: `other` >> `outside` at low levels.
7. Monte Carlo passes at leg and set scope using asymmetric deviation bands (§3).
8. `checkoutHitRateForDart` returns independent rates per double attempt, each within checkout % range.
9. Soft set-level convergence activates only outside set deviation band; shifts capped; leg variance preserved.
