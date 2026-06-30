import type { SimulatedVisit } from "@lib/shared/dartbot";

export function deriveBotVisitDartMetadata(visit: SimulatedVisit) {
  const dartsOnDouble = visit.darts.filter(
    (d) => d.actual.ring === "double" || d.actual.ring === "bull",
  ).length;
  const dartsThrown = visit.darts.length;
  return {
    dartsThrown,
    dartsOnDouble,
    dartsForFinish: visit.checkout ? dartsThrown : undefined,
  };
}
