import { computeConvergenceBias } from "./convergence";
import { nextCheckoutTarget } from "./checkout-target";
import { scoreForSegment, parseSegment } from "./segments";
import { chooseIntent } from "./strategy-engine";
import { throwDart } from "./throw-engine";
import { createEmptySetRunningStats } from "./types";
import {
  createCheckoutKnowledge,
  type CheckoutKnowledge,
} from "./checkout/CheckoutKnowledge";
import { evaluateSetupRoute } from "./checkout/CheckoutEvaluator";
import type { BotCheckoutRoute } from "./checkout/bot-checkout-route";
import type { Rng } from "./rng";
import type {
  Segment,
  SimulateVisitContext,
  SimulatedVisit,
} from "./types";

const checkoutKnowledge = createCheckoutKnowledge();

function isDoubleOrBull(segment: Segment): boolean {
  return segment.ring === "double" || segment.ring === "bull";
}

function visitResult(
  darts: SimulatedVisit["darts"],
  bust: boolean,
  checkout: boolean,
): SimulatedVisit {
  return {
    darts,
    visitScore: darts.reduce((sum, dart) => sum + dart.score, 0),
    bust,
    checkout,
  };
}

function bestSetupRoute(
  remaining: number,
  knowledge: CheckoutKnowledge,
): BotCheckoutRoute | null {
  const routes = knowledge.routes(remaining);
  if (routes.length === 0) return null;

  let best = routes[0]!;
  let bestScore = evaluateSetupRoute(best);
  for (const route of routes.slice(1)) {
    const score = evaluateSetupRoute(route);
    if (score > bestScore) {
      best = route;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Simulates one 1-3 dart visit by coordinating intent, targeting, throw execution, and finish rules.
 */
export function simulateVisit(
  ctx: SimulateVisitContext,
  rng: Rng,
): SimulatedVisit {
  const maxDarts = Math.max(1, Math.min(3, ctx.dartsInVisit));
  const darts: SimulatedVisit["darts"] = [];
  let remaining = ctx.remaining;
  const setStats = ctx.setRunningStats ?? createEmptySetRunningStats();
  const bias = computeConvergenceBias(setStats, ctx.skill);

  for (let index = 0; index < maxDarts; index += 1) {
    const dartIndexInVisit = (index + 1) as 1 | 2 | 3;
    const dartsLeft = maxDarts - index;
    const intent = chooseIntent({
      remaining,
      dartsLeft,
      skill: ctx.skill,
      legTarget: ctx.legTarget,
    });

    let target: Segment = parseSegment(ctx.skill.scoring.aim);
    if (intent === "score") {
      target = parseSegment(ctx.skill.scoring.aim);
    } else {
      const hintTarget = nextCheckoutTarget(remaining);
      if (intent === "setup" && remaining >= 131 && remaining <= 170) {
        const setupRoute = bestSetupRoute(remaining, checkoutKnowledge);
        target = setupRoute?.darts[0] ?? hintTarget ?? target;
      } else if (hintTarget) {
        target = hintTarget;
      }
    }

    const actual = throwDart(
      target,
      ctx.skill,
      intent,
      dartIndexInVisit,
      bias,
      rng,
    );
    const score = scoreForSegment(actual);
    darts.push({ target, actual, score });
    remaining -= score;

    if (remaining === 0) {
      if (isDoubleOrBull(actual)) return visitResult(darts, false, true);
      return visitResult(darts, true, false);
    }
    if (remaining < 0 || remaining === 1) {
      return visitResult(darts, true, false);
    }
  }

  return visitResult(darts, false, false);
}
