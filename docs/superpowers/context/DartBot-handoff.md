I reviewed the direction before adding checkout routing.

The biggest risk here is overfitting checkout logic into static tables.

A production design should treat checkout routing as:

- **route knowledge** (what professionals would attempt)
- **route selection** (which route this bot chooses)
- **execution** (whether darts hit)

Not:

```text
remaining=81
→ T19 D12
```

hardcoded into gameplay.

So the correct abstraction is a **Checkout Knowledge Base + Route Planner**.

---

# Checkout Route System (Production Design)

## Goal

Generate realistic checkout attempts that:

- support multiple valid routes per finish
- allow level-dependent route quality
- support setup play
- react to misses naturally
- remain deterministic and testable

---

## Folder Structure

```text
checkout/
├── CheckoutTable.ts
├── CheckoutPlanner.ts
├── CheckoutRoute.ts
├── CheckoutKnowledge.ts
├── CheckoutEvaluator.ts
└── CheckoutPolicy.ts
```

---

# Domain

## CheckoutRoute.ts

Represents an intended route.

```ts
export type CheckoutRoute = {
  finish: number;

  darts: Segment[];

  quality: number;

  preferredLeave?: number;
};
```

Example:

```ts
{
    finish: 81,

    darts: [
        T19,
        D12
    ],

    quality: 95
}
```

Multiple routes exist.

---

# Knowledge Base

## CheckoutKnowledge.ts

Static route data.

```ts
export interface CheckoutKnowledge {
  routes(remaining: number): CheckoutRoute[];
}
```

Implementation:

```ts
export class StaticCheckoutKnowledge implements CheckoutKnowledge {
  private table = new Map<number, CheckoutRoute[]>();

  routes(remaining: number) {
    return this.table.get(remaining) ?? [];
  }
}
```

Example data:

```ts
81:
[
 {
   finish:81,
   darts:[
     T19,
     D12
   ],
   quality:95
 },

 {
   finish:81,
   darts:[
     T15,
     D18
   ],
   quality:90
 }
]
```

Store outside code.

JSON preferred.

---

# Checkout Policy

Controls decision quality.

```ts
export interface CheckoutPolicy {
  select(routes: CheckoutRoute[], skill: SkillProfile): CheckoutRoute;
}
```

---

## Route Selection

```ts
export class SkillCheckoutPolicy implements CheckoutPolicy {
  select(routes, skill) {
    const sorted = routes.sort((a, b) => b.quality - a.quality);

    const spread = Math.floor((1 - skill.checkoutDiscipline) * sorted.length);

    return sorted[Math.min(spread, sorted.length - 1)];
  }
}
```

Effect:

```text
Level 15
→ almost optimal

Level 1
→ occasionally strange routes
```

---

# Route Evaluation

Required for setup realism.

```ts
export interface CheckoutEvaluator {
  evaluate(route: CheckoutRoute): number;
}
```

Example:

```ts
score = finishProbability + leaveQuality - risk;
```

---

# Checkout Planner

Coordinates routing.

```ts
export class CheckoutPlanner {
  constructor(
    private knowledge: CheckoutKnowledge,

    private policy: CheckoutPolicy,
  ) {}

  route(remaining: number, skill: SkillProfile) {
    const routes = this.knowledge.routes(remaining);

    return this.policy.select(routes, skill);
  }
}
```

---

# Runtime Example

```text
Score:
81

↓

Planner

↓

Route:
T19
D12

↓

Throw

↓

S19

↓

Remaining:
62

↓

Recalculate

↓

T10
D16
```

Misses create new routes.

No forced completion.

---

# Integration Into DartBot

Replace:

```ts
route.choose();
```

with:

```ts
planner.route(remaining, skill);
```

Execution becomes:

```text
Intent
↓
CheckoutPlanner
↓
Route
↓
ThrowEngine
↓
Evaluate
↓
Continue
```

---

# Final Agentic Build Handoff

Good catch. That is a real omission.

The previous handoff accidentally reduced levels to abstract accuracy values and lost the original product requirement:

> Levels represent **3-dart average**, **checkout average**, and **scoring average**.

That is not a minor detail — those metrics are the contract that defines DartBot behavior.

The architecture should treat those values as **first-class configuration inputs**, not derived outputs.

Below is the missing section that should be added to the handoff.

---

# Level System Specification (Authoritative Skill Model)

## Goal

Each DartBot level (1–15) represents a statistical performance profile.

Levels are defined by:

1. **3 Dart Average (3DA)**
   Average points per visit across all darts, including checkout darts.

2. **Scoring Average (SA)**
   Average points per visit excluding checkout attempts.

3. **Checkout Performance**
   - Checkout Average (average darts needed after reaching finish range)
   - Checkout Percentage (success rate per checkout opportunity)

These metrics are targets across the configured match scope.

---

# Domain Model

```ts
export type LevelProfile = {
  level: number;

  threeDartAverage: {
    min: number;
    max: number;
  };

  scoringAverage: {
    min: number;
    max: number;
  };

  checkout: {
    average: number;

    successRate: number;
  };

  execution: {
    hitAccuracy: number;

    missSpread: number;

    checkoutDiscipline: number;

    variance: number;
  };
};
```

---

# Level Definitions

Example baseline profiles.

Values are targets and may be tuned later.

```ts
export const LEVELS: LevelProfile[] = [
  {
    level: 1,

    threeDartAverage: {
      min: 30,
      max: 40,
    },

    scoringAverage: {
      min: 37,
      max: 47,
    },

    checkout: {
      average: 8,
      successRate: 0.3,
    },

    execution: {
      hitAccuracy: 0.25,
      missSpread: 0.45,
      checkoutDiscipline: 0.3,
      variance: 25,
    },
  },

  {
    level: 5,

    threeDartAverage: {
      min: 48,
      max: 58,
    },

    scoringAverage: {
      min: 53,
      max: 63,
    },

    checkout: {
      average: 20,
      successRate: 0.4,
    },

    execution: {
      hitAccuracy: 0.55,
      missSpread: 0.3,
      checkoutDiscipline: 0.55,
      variance: 18,
    },
  },

  {
    level: 10,

    threeDartAverage: {
      min: 67,
      max: 77,
    },

    scoringAverage: {
      min: 75,
      max: 85,
    },

    checkout: {
      average: 30,
      successRate: 0.55,
    },

    execution: {
      hitAccuracy: 0.75,
      missSpread: 0.18,
      checkoutDiscipline: 0.8,
      variance: 12,
    },
  },

  {
    level: 15,

    threeDartAverage: {
      min: 90,
      max: 999,
    },

    scoringAverage: {
      min: 95,
      max: 999,
    },

    checkout: {
      average: 45,
      successRate: 0.8,
    },

    execution: {
      hitAccuracy: 0.88,
      missSpread: 0.08,
      checkoutDiscipline: 0.95,
      variance: 8,
    },
  },
];
```

---

# How Levels Drive the System

```text
Level
↓
LevelProfile
↓
MatchPlanner
↓
Strategy Quality
↓
Route Selection
↓
Throw Accuracy
↓
Statistics Validation
```

Level should influence:

| Component        | Controlled By      |
| ---------------- | ------------------ |
| Match averages   | 3DA                |
| Raw scoring      | Scoring Average    |
| Finish quality   | Checkout           |
| Target precision | hitAccuracy        |
| Miss realism     | missSpread         |
| Route choices    | checkoutDiscipline |
| Leg consistency  | variance           |

---

# Statistics Engine (Authoritative Validation)

At end of match:

```ts
export type MatchStats = {
  threeDartAverage: number;

  scoringAverage: number;

  checkoutAverage: number;

  checkoutRate: number;
};
```

Validation:

```text
Actual stats
≈
Configured level profile
```

Tolerance:

```text
3DA:
±5%

Scoring:
±5%

Checkout Avg:
±10%

Checkout %:
±10%
```

No hard enforcement.

Only soft convergence.

---

# Match Planning Constraints

The planner must generate targets from:

```text
Level
+
Match length
+
Variance
```

Example:

```text
Level 10

Target:
72 3DA

5 legs

Generated:
69
75
70
80
66

Average:
72
```

Not:

```text
72
72
72
72
72
```

---

# Final Runtime Flow (updated)

```text
Select Level
↓
Load LevelProfile
↓
Generate MatchPlan
↓
Determine Intent
↓
Choose Route
↓
Simulate Throw
↓
Resolve Miss
↓
Update Statistics
↓
Soft Match Correction
↓
Validate Targets
```

This closes the missing link between **product requirements (levels)** and **implementation architecture**. Without this section, the implementation could technically work while violating the intended difficulty model.
