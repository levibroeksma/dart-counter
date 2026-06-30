import { chooseScoringTarget } from "./route-engine";
import { scoreForSegment, parseSegment } from "./segments";
import { chooseIntent } from "./strategy-engine";
import { throwDart } from "./throw-engine";
import {
  createCheckoutKnowledge,
  type CheckoutKnowledge,
} from "./checkout/CheckoutKnowledge";
import { SkillCheckoutPolicy } from "./checkout/CheckoutPolicy";
import { CheckoutPlanner } from "./checkout/CheckoutPlanner";
import { evaluateSetupRoute } from "./checkout/CheckoutEvaluator";
import type { BotCheckoutRoute } from "./checkout/bot-checkout-route";
import type { Rng } from "./rng";
import type {
  Segment,
  SimulateVisitContext,
  SimulatedVisit,
} from "./types";

const checkoutKnowledge = createCheckoutKnowledge();
const checkoutPlanner = new CheckoutPlanner(
  checkoutKnowledge,
  new SkillCheckoutPolicy(),
);

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

function coerceFinishingTarget(target: Segment, remaining: number): Segment {
  if (isDoubleOrBull(target)) return target;
  if (remaining === 50) return parseSegment("50");
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) {
    return parseSegment(`D${remaining / 2}`);
  }
  return parseSegment("50");
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

  for (let index = 0; index < maxDarts; index += 1) {
    const dartsLeft = maxDarts - index;
    const intent = chooseIntent({
      remaining,
      dartsLeft,
      skill: ctx.skill,
      legTarget: ctx.legTarget,
    });

    let target: Segment;
    if (intent === "score") {
      target = chooseScoringTarget({
        skill: ctx.skill,
        legTarget: ctx.legTarget,
        rng,
      });
    } else {
      const plannerRoute = checkoutPlanner.route(remaining, ctx.skill);
      const setupRoute = bestSetupRoute(remaining, checkoutKnowledge);
      target =
        intent === "setup" && setupRoute
          ? setupRoute.darts[0]!
          : plannerRoute.darts[0]!;
    }

    if (dartsLeft === 1 || remaining <= 50) {
      target = coerceFinishingTarget(target, remaining);
    }

    const actual = throwDart(target, ctx.skill, rng);
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
